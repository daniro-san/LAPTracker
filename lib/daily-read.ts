// The daily roster read (D60, issue 197): once a day the tick reads DAILY_ROSTER_IDS through /v1 and stores
// each roster as uid/name/power/kills arrays, for the member history page. It is not an event: no events
// row, no snapshot, no Discord message beyond one admin line when it falls short. No internal fallback
// (D5 covers event snapshots only): a missed alliance is a gap in the history. It writes run_logs lines
// under its day (`read_day`) with the collector's codes, so /admin/runs/daily/[day] shows its calls.
import { ALLIANCES } from "../config/alliances";
import { dailyReadQuota } from "./budget";
import { MAX_UPSTREAM_CALLS, RUN_DEADLINE_MS } from "./collector";
import { failedList, FRESH_MAX_AGE_MS } from "./collector-rows";
import { isFresh, RUN_STALE_AFTER_MS } from "./compute";
import type { Db } from "./db";
import { createRunLogger, type RunLogger } from "./logger";
import {
  claimDailyRead,
  finishDailyRead,
  insertDailyRoster,
  reclaimDailyRead,
  type DailyReadStatus,
  type NewDailyRoster,
} from "./repo/daily-reads";
import { insertRunLog } from "./repo/run-logs";
import { QuotaExhaustedError, type AllianceSnapshotInput, type V1Source } from "./sources/types";
import { describe, httpStatusOf, upstreamDetail } from "./upstream-errors";

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

const tagOf = (unionId: number) => ALLIANCES.find((a) => a.unionId === unionId)?.tag ?? null;

function dataRow(a: AllianceSnapshotInput, now: Date): NewDailyRoster {
  return {
    unionId: a.unionId,
    tag: a.tag,
    name: a.name,
    memberCount: a.memberCount,
    totalPower: a.totalPower,
    totalKills: a.totalKills,
    badgeId: a.badgeId ?? null,
    sourceUpdatedAt: a.sourceUpdatedAt,
    // INVARIANT freshness.20-min: the same rule as event snapshots.
    isFresh: isFresh(now, a.sourceUpdatedAt, FRESH_MAX_AGE_MS),
    error: null,
    memberUids: a.members.map((m) => m.uid),
    memberNames: a.members.map((m) => m.name),
    // Arrays keep a null power or kills as null (D15); Drizzle types the elements as numbers.
    memberPower: a.members.map((m) => m.power) as number[],
    memberKills: a.members.map((m) => m.kills) as number[],
  };
}

/** `e` is the failure itself: its upstream detail (D61) goes on the row for /admin/runs. */
const errorRow = (unionId: number, error: string, e: unknown): NewDailyRoster => ({
  unionId,
  tag: tagOf(unionId),
  isFresh: false,
  error,
  errorDetail: upstreamDetail(e),
  memberUids: [],
  memberNames: [],
  memberPower: [],
  memberKills: [],
});

/** `secrets` (secretsOf(env)) are masked in the run_logs lines; tests may leave them out. */
type Deps = { v1: V1Source; now: () => Date; secrets?: readonly string[] };

interface Read {
  deps: Deps;
  log: RunLogger;
  controller: AbortController;
  calls: number;
  abort: string | null;
  remaining: number | null;
  rows: NewDailyRoster[];
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
async function readOne(read: Read, id: number): Promise<void> {
  const { v1, now } = read.deps;
  const started = now();
  const call = { endpoint: "alliance", unionId: id } as const;
  try {
    const a = await v1.fetchAlliance(id, attemptHook(read, id), read.controller.signal);
    if (read.abort !== null) return;
    await logFetch(read, started, call, { cached: a.cached, quota: a.quota?.remaining ?? null });
    const row = dataRow(a, now());
    if (!row.isFresh) await read.log.warn("stale", { union_id: id });
    read.rows.push(row);
  } catch (e) {
    if (read.controller.signal.aborted) return;
    await logFetch(read, started, call, { error: e });
    if (e instanceof QuotaExhaustedError || e instanceof CallCapError) {
      read.abort ??= describe(e);
      return;
    }
    read.rows.push(errorRow(id, `v1 ${describe(e)}`, e));
  }
}

/** The quota check and its v1.fetch line; null when the read may not start, with why. */
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
  const needed = dailyReadQuota(n, ALLIANCES.length);
  if (read.remaining >= needed) return null;
  await read.log.error("quota", { remaining: read.remaining, required: needed });
  return `quota: remaining ${read.remaining} < required ${needed}`;
}

/** The quota check, then the rosters; returns the reason the read stopped short, else null. */
async function readRosters(read: Read, ids: readonly number[]): Promise<string | null> {
  const quotaError = await checkQuota(read, ids.length);
  if (quotaError) return quotaError;
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined && read.abort === null; id = queue.shift())
      await readOne(read, id);
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
  ids: readonly number[],
): Promise<DailyReadSummary | null> {
  if (!(await claimDailyRead(db, day, deps.now()))) return null;
  return readDay(deps, db, day, ids);
}

/** /admin's retry: the same read again for a day that failed, or that was left `running` past
 * RUN_STALE_AFTER_MS (the function was killed). Null for any other day (no read, running, complete,
 * partial) or when another press took it first. */
export async function retryDailyRead(
  deps: Deps,
  db: Db,
  day: string,
  ids: readonly number[],
): Promise<DailyReadSummary | null> {
  const now = deps.now();
  // INVARIANT run.stale-after-150s: the snapshots' rule for a killed run.
  const staleBefore = new Date(now.getTime() - RUN_STALE_AFTER_MS);
  if (!(await reclaimDailyRead(db, day, now, staleBefore))) return null;
  return readDay(deps, db, day, ids);
}

async function readDay(
  deps: Deps,
  db: Db,
  day: string,
  ids: readonly number[],
): Promise<DailyReadSummary> {
  const log = createRunLogger(
    { insertRunLog: (line) => insertRunLog(db, line) },
    { readDay: day, secrets: deps.secrets ?? [], now: deps.now },
  );
  await log.info("daily.start", { alliances: ids.length });
  const read: Read = {
    deps,
    log,
    controller: new AbortController(),
    calls: 0,
    abort: null,
    remaining: null,
    rows: [],
  };
  const error = await withDeadline(read, readRosters(read, ids));
  if (error === "deadline") await log.warn("run.deadline", { calls_used: read.calls });
  else if (error && !error.startsWith("quota")) await log.error("abort", { reason: error });
  const rows = [...read.rows];
  for (const row of rows) await insertDailyRoster(db, day, row);
  const ok = rows.filter((r) => r.error === null);
  const status: DailyReadStatus =
    ok.length === 0
      ? "failed"
      : error === null && ok.length === ids.length && ok.every((r) => r.isFresh)
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
  const failed = failedList(
    rows.map((r) => ({
      unionId: r.unionId,
      tag: r.tag ?? null,
      isFresh: r.isFresh,
      error: r.error ?? null,
    })),
    [...ids],
    error,
  );
  return {
    day,
    status,
    callsUsed: read.calls,
    error,
    failed,
    stale: ok.filter((r) => !r.isFresh).map((r) => ({ unionId: r.unionId, tag: r.tag ?? null })),
  };
}
