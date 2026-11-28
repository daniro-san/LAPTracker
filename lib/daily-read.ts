// The daily roster read (D60, issue 197): once a day, at the end of the server day (D72), the tick reads
// the day's tracked set and every workspace's alliance (D133; `dailyTargets`) through /v1 and stores each
// roster as uid/name/power/kills arrays, for the member history page, plus the trimmed response in raw_json,
// of which a read model selects only the statement and joining fields (D128). It is not an event: no events
// row, no snapshot, no Discord message beyond one admin line when it falls short. No internal fallback
// (D5 covers event snapshots only): a missed alliance is a gap in the history. It writes run_logs lines
// under its day (`read_day`) with the collector's codes, so /admin/runs/daily/[day] shows its calls.
import { TRACKED_COUNT } from "../config/alliances";
import { dailyReadQuota } from "./budget";
import { MAX_UPSTREAM_CALLS, RUN_DEADLINE_MS } from "./collector";
import { checkIdentity } from "./collector-identity";
import { logRosterCheck } from "./collector-log";
import { failedList, FRESH_MAX_AGE_MS } from "./collector-rows";
import { isFresh, RUN_STALE_AFTER_MS } from "./compute";
import { dataRow, errorRow } from "./daily-rows";
import type { Db } from "./db";
import { createRunLogger, type RunLogger } from "./logger";
import { allianceLabels } from "./repo/alliances";
import {
  claimAutoRetry,
  claimDailyRead,
  dailyRosterStates,
  finishDailyRead,
  getDailyRead,
  lastMemberUids,
  lookupRostersBefore,
  reclaimDailyRead,
  storeDailyRoster,
  type DailyReadStatus,
  type NewDailyRoster,
} from "./repo/daily-reads";
import { recordFrames } from "./repo/player-frames";
import { insertRunLog } from "./repo/run-logs";
import { markKey } from "./repo/workspace-keys";
import { endsInServerDay, serverDay, type ScheduleConfig } from "./schedule";
import { QuotaExhaustedError, type AllianceSnapshotInput, type V1Source } from "./sources/types";
import { describe, httpStatusOf, upstreamDetail } from "./upstream-errors";
import { keyStatusOf, type DailyTarget, type OpenKey } from "./workspace-keys";

const CONCURRENCY = 4;

export interface DailyReadSummary {
  day: string;
  status: DailyReadStatus;
  callsUsed: number;
  error: string | null;
  failed: { unionId: number; tag: string | null; error: string }[];
  stale: { unionId: number; tag: string | null }[];
}

class CallCapError extends Error {
  override name = "CallCapError";
}

/** `secrets` (secretsOf(env)) are masked in the run_logs lines; tests may leave them out. `opponentCalls`: the
 * KvK opponent's calls still due on the read's quota day (D152, `opponentReserve`); none when left out.
 * `eventReads`: the event windows' Befores and Afters still due that day (D160, `eventReadsDueToday`); a
 * one-window event's two when left out. */
type Deps = {
  v1: V1Source;
  now: () => Date;
  secrets?: readonly string[];
  opponentCalls?: number;
  eventReads?: number;
};

interface Read {
  deps: Deps;
  log: RunLogger;
  controller: AbortController;
  calls: number;
  abort: string | null;
  remaining: number | null;
  rows: NewDailyRoster[];
  /** Each read roster's members and upstream time, for the players' current frames (D65). */
  frames: { members: AllianceSnapshotInput["members"]; seenAt: Date | null }[];
  /** The alliances read on a workspace's own key (D124, D133); the others on LAP_API_KEY. */
  keys: Map<number, OpenKey>;
  tags: Map<number, string | null>;
  /** What the identity check compares a read with (D69 amendment, 2026-11-21); no board in a daily read. */
  identity: Parameters<typeof checkIdentity>[0];
}

/** INVARIANT calls.max-upstream: every /v1 attempt, quota check and retries included. */
const attemptHook =
  (read: Read, unionId: number | null) => (attempt: number, status?: number | null) => {
    if (read.calls >= MAX_UPSTREAM_CALLS) throw new CallCapError("MAX_UPSTREAM_CALLS reached");
    read.calls++;
    const retry = { union_id: unionId, retry_n: attempt, http_status: status ?? null };
    if (attempt > 0) void read.log.warn("v1.retry", retry);
  };

/** One v1.fetch line per call, as the collector writes it, so runTrace reads both alike. */
async function logFetch(
  read: Read,
  started: Date,
  call: { endpoint: "quota" | "alliance"; unionId: number | null },
  result: { cached?: boolean | null; quota?: number | null; error?: unknown },
): Promise<void> {
  const e = result.error;
  await read.log[e === undefined ? "info" : "warn"]("v1.fetch", {
    endpoint: call.endpoint,
    union_id: call.unionId,
    http_status: httpStatusOf(e),
    cached: result.cached ?? null,
    duration_ms: read.deps.now().getTime() - started.getTime(),
    quota_remaining: result.quota ?? null,
    ...(e === undefined ? {} : { error: describe(e), detail: upstreamDetail(e) }),
  });
}

/** One alliance: its row, and its v1.fetch (and stale) line. A call the deadline cut writes neither. */
async function readOne(read: Read, db: Db, id: number): Promise<void> {
  const { v1, now } = read.deps;
  const started = now();
  const call = { endpoint: "alliance", unionId: id } as const;
  const key = read.keys.get(id);
  try {
    const a = await v1.fetchAlliance(
      id,
      attemptHook(read, id),
      read.controller.signal,
      key && { apiKey: key.apiKey },
    );
    if (read.abort !== null) return;
    // A 200 holding another alliance is this alliance's failed read: its error row, no roster stored.
    checkIdentity(read.identity, id, a);
    await logFetch(read, started, call, { cached: a.cached, quota: a.quota?.remaining ?? null });
    await logRosterCheck(read.log, a);
    const row = dataRow(a, now());
    if (!row.isFresh) await read.log.warn("stale", { union_id: id });
    read.rows.push(row);
    read.frames.push({ members: a.members, seenAt: a.sourceUpdatedAt });
  } catch (e) {
    if (read.controller.signal.aborted) return;
    await logFetch(read, started, call, { error: e });
    await failOne(read, db, id, e);
  }
}

/** A failed read. A workspace key's 401 or 429 is that key's (D124): it marks the key and fails this alliance
 * only. A 429 on ours, or the call cap, stops the read. Anything else is the alliance's error row. */
async function failOne(read: Read, db: Db, id: number, e: unknown): Promise<void> {
  const key = read.keys.get(id);
  const status = key ? keyStatusOf(e) : null;
  if (key && status) {
    const quota = status === "out_of_quota" ? { quotaRemaining: 0 } : {};
    await markKey(db, key.workspaceId, key.nonce, { status, ...quota }, read.deps.now());
  } else if (e instanceof QuotaExhaustedError || e instanceof CallCapError) {
    read.abort ??= describe(e);
    return;
  }
  read.rows.push(errorRow(id, read.tags.get(id) ?? null, `v1 ${describe(e)}`, e));
}

/** The quota check and its v1.fetch line; null when the read may not start, with why. `n`: the reads on
 * LAP_API_KEY. */
async function checkQuota(read: Read, n: number): Promise<string | null> {
  const started = read.deps.now();
  const call = { endpoint: "quota", unionId: null } as const;
  try {
    const quota = await read.deps.v1.fetchQuota(attemptHook(read, null), read.controller.signal);
    read.remaining = quota.remaining;
    await logFetch(read, started, call, { quota: quota.remaining });
  } catch (e) {
    // Cut by the deadline: the read has closed, so no line (D25).
    if (!read.controller.signal.aborted) await logFetch(read, started, call, { error: e });
    return `quota: ${describe(e)}`;
  }
  // INVARIANT budget.daily-keeps-event-reserve
  // The KvK opponent's calls still due that day count too (D152); the caller passes 0 on other days.
  const needed = dailyReadQuota(
    n,
    TRACKED_COUNT,
    read.deps.opponentCalls ?? 0,
    read.deps.eventReads,
  );
  if (read.remaining >= needed) return null;
  await read.log.error("quota", { remaining: read.remaining, required: needed });
  return `quota: remaining ${read.remaining} < required ${needed}`;
}

/** The quota check, then the rosters; returns the reason the read stopped short, else null. */
async function readRosters(read: Read, db: Db, ids: readonly number[]): Promise<string | null> {
  const quotaError = await checkQuota(read, ids.filter((id) => !read.keys.has(id)).length);
  if (quotaError) return quotaError;
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined && read.abort === null; id = queue.shift())
      await readOne(read, db, id);
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return read.abort;
}

/** INVARIANT run.deadline-100s: past this no read starts and in-flight reads are cut. */
async function withDeadline(read: Read, work: Promise<string | null>): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<string>((resolve) => {
    timer = setTimeout(() => {
      read.abort ??= "deadline";
      read.controller.abort();
      resolve("deadline");
    }, RUN_DEADLINE_MS);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads the day's rosters once. Returns null when another caller already claimed the day. The run is
 * bounded like an event snapshot: MAX_UPSTREAM_CALLS, the 100 s deadline, a 429 stops it.
 */
export async function runDailyRead(
  deps: Deps,
  db: Db,
  day: string,
  targets: readonly DailyTarget[],
): Promise<DailyReadSummary | null> {
  const now = deps.now();
  const ids = targets.map((t) => t.unionId);
  if (!(await claimDailyRead(db, day, now, ids))) return null;
  return readDay(deps, db, day, targets, now, { toRead: ids, code: "daily.start" });
}

/** A daily read, or /admin's Retry of it, may start at `now`: a run of up to RUN_DEADLINE_MS ends inside
 * now's server day (D72). */
export const dailyReadEndsInDay = (now: Date, cfg: Pick<ScheduleConfig, "SERVER_TZ">) =>
  endsInServerDay(now, RUN_DEADLINE_MS, cfg);

/** /admin's retry (D67): the same read again, every roster, of today's server day when it fell short
 * (`failed` or `partial`) or was left `running` past RUN_STALE_AFTER_MS (the function was killed).
 * "too-late" when a read started now could run past the server day's end (D72); null for any other day
 * (no read, running, complete) or when another press took it first. */
export async function retryDailyRead(
  deps: Deps,
  db: Db,
  cfg: Pick<ScheduleConfig, "SERVER_TZ">,
  targets: readonly DailyTarget[],
): Promise<DailyReadSummary | "too-late" | null> {
  const now = deps.now();
  // INVARIANT daily-read.ends-before-midnight: a Retry that could run past 00:00 would store rosters
  // read after the reset under the day before; the day keeps its gap instead (D72).
  if (!dailyReadEndsInDay(now, cfg)) return "too-late";
  const day = serverDay(now, cfg);
  // INVARIANT run.stale-after-150s: the snapshots' rule for a killed run.
  const staleBefore = new Date(now.getTime() - RUN_STALE_AFTER_MS);
  const ids = targets.map((t) => t.unionId);
  if (!(await reclaimDailyRead(db, day, now, staleBefore, ids))) return null;
  return readDay(deps, db, day, targets, now, { toRead: ids, code: "daily.start" });
}

/** A later tick, not a second caller of the same one: ticks are 15 minutes apart (D26). */
const AUTO_RETRY_AFTER_MS = 10 * 60_000;

/**
 * The tick's automatic retry (D72): on a later tick of the same server day, a read that fell short
 * (`failed` or `partial`) reads again only the alliances with no roster for the day, once per day. A
 * "Get today's details" roster stored before the read started is not one the read read (issue 625): it reads
 * that alliance too. A roster the read stored, stale or not, is never read again (D72). Null when the day has
 * a roster of every alliance (a `complete` day included), was retried automatically already, is running, or
 * read too recently.
 */
export async function autoRetryDailyRead(
  deps: Deps,
  db: Db,
  day: string,
  targets: readonly DailyTarget[],
): Promise<DailyReadSummary | null> {
  const ids = targets.map((t) => t.unionId);
  // The claim moves started_at to the retry; the rosters it keeps are judged against the read it completes.
  const before = await getDailyRead(db, day);
  if (!before) return null;
  const lookups = new Set(await lookupRostersBefore(db, day, before.startedAt));
  const read = new Set(
    (await dailyRosterStates(db, day))
      .filter((r) => r.error === null && !lookups.has(r.unionId))
      .map((r) => r.unionId),
  );
  const missing = ids.filter((id) => !read.has(id));
  if (missing.length === 0) return null;
  const now = deps.now();
  const startedBefore = new Date(now.getTime() - AUTO_RETRY_AFTER_MS);
  if (!(await claimAutoRetry(db, day, now, startedBefore, ids))) return null;
  return readDay(deps, db, day, targets, now, {
    toRead: missing,
    code: "daily.auto-retry",
    keptJudgedAt: before.startedAt,
  });
}

/** `startedAt` is this read's start as the claim stored it. `targets` are the day's alliances, which the
 * outcome is judged on (a lookup's roster stored under the same day is not one of them, D133); `toRead` the ones this attempt reads: all of them, or for the tick's automatic
 * retry only the ones without a roster (D72); `code` names the attempt's first log line;
 * `keptJudgedAt`, the automatic retry's only, is the start of the read it completes. */
async function readDay(
  deps: Deps,
  db: Db,
  day: string,
  targets: readonly DailyTarget[],
  startedAt: Date,
  attempt: {
    toRead: readonly number[];
    code: "daily.start" | "daily.auto-retry";
    keptJudgedAt?: Date;
  },
): Promise<DailyReadSummary> {
  const ids = targets.map((t) => t.unionId);
  const keys = new Map(targets.flatMap((t) => (t.key ? [[t.unionId, t.key] as const] : [])));
  // A workspace key is masked in this read's lines like ours (D124).
  const secrets = [...(deps.secrets ?? []), ...[...keys.values()].map((k) => k.apiKey)];
  const log = createRunLogger(
    { insertRunLog: (line) => insertRunLog(db, line) },
    { readDay: day, secrets, now: deps.now },
  );
  const labels = await allianceLabels(db, ids);
  await log.info(attempt.code, { alliances: attempt.toRead.length });
  const read: Read = {
    deps,
    log,
    controller: new AbortController(),
    calls: 0,
    abort: null,
    remaining: null,
    rows: [],
    frames: [],
    keys,
    tags: new Map(ids.map((id) => [id, labels.get(id)?.tag ?? null])),
    identity: { board: null, labels, rosters: await lastMemberUids(db, ids) },
  };
  const error = await withDeadline(read, readRosters(read, db, attempt.toRead));
  if (error === "deadline") await log.warn("run.deadline", { calls_used: read.calls });
  else if (error && !error.startsWith("quota")) await log.error("abort", { reason: error });
  for (const row of [...read.rows]) await storeDailyRoster(db, day, row, deps.now());
  for (const f of read.frames) await recordFrames(db, f.members, f.seenAt);
  // The day's rows, not this attempt's: after a retry they include the rosters it kept (D67).
  const rows = (await dailyRosterStates(db, day)).filter((r) => ids.includes(r.unionId));
  const ok = rows.filter((r) => r.error === null);
  // INVARIANT freshness.20-min, for the day: a roster kept from an earlier read is stale in the day's
  // outcome once it is more than 20 minutes older than this read's start, or, for the tick's automatic
  // retry, than the start of the read it completes (D72): the retry reads only the missing rosters, so
  // the 15 minutes between the two ticks must not age the ones it kept. Its stored `is_fresh` stays.
  const judgedAt = attempt.keptJudgedAt ?? startedAt;
  const stale = ok.filter(
    (r) => !r.isFresh || !isFresh(judgedAt, r.sourceUpdatedAt, FRESH_MAX_AGE_MS),
  );
  const status: DailyReadStatus =
    ok.length === 0
      ? "failed"
      : error === null && ok.length === ids.length && stale.length === 0
        ? "complete"
        : "partial";
  await finishDailyRead(db, day, {
    status,
    finishedAt: deps.now(),
    callsUsed: read.calls,
    quotaRemainingBefore: read.remaining,
    error,
  });
  await log.info("daily.finish", { status, calls_used: read.calls });
  await log.shutdown();
  // Error rows, then the alliances the read never reached (deadline, 429, call cap, quota rule),
  // named as the collector names them, so the admin line accounts for every alliance.
  const failed = failedList(rows, [...ids], error, read.tags);
  return {
    day,
    status,
    callsUsed: read.calls,
    error,
    failed,
    stale: stale.map((r) => ({ unionId: r.unionId, tag: r.tag })),
  };
}
