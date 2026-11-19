// The nightly squads read (D117, issue 413): after the day's roster read (D72), one GET /v1/players/{uid}
// per member of each read alliance's roster, the tracker's cached copy (no `fresh`), sequential and paced.
// D124: OWN_ALLIANCE_ID on LAP_API_KEY until its officers save their own key, and every workspace with a
// usable key of its own on that key and its quota only, each alliance's batch alongside the others. It
// runs in batches of at most RUN_DEADLINE_MS: each cron-job.org tick in the window starts the next batch
// after its answer (lib/squads-tick.ts); POST /api/squads-read (tick.yml, or by hand) is the backup path,
// and the claim keeps the two from overlapping. Each batch starts only when it ends inside the server day
// (nothing after 23:58:20). The run never spends below `squadsReserve` (the event's quota day keeps its
// reads), makes one call per member in the pass plus at most one retry for a 5xx or no answer (the
// cursor and the retry list are saved after every call, under the batch's claim), and never makes more
// calls in a day than SQUAD_CALLS_MAX, retries included. Its log lines are counts, the quota left and
// reasons: no names, no squads.
import { ALLIANCES } from "../config/alliances";
import { eventWorkspace } from "./analytics/server";
import { RUN_DEADLINE_MS, RUN_STALE_AFTER_MS } from "./compute";
import type { Db } from "./db";
import type { Env } from "./env";
import { refreshHeroCatalog } from "./heroes";
import { createRunLogger, type RunLogger } from "./logger";
import { getDailyRead } from "./repo/daily-reads";
import { insertRunLog } from "./repo/run-logs";
import {
  claimSquadBatch,
  dayRosterUids,
  getSquadRead,
  startSquadRead,
  updateClaimedSquadRead,
  type SquadRead,
} from "./repo/squads";
import { markKey } from "./repo/workspace-keys";
import { dailyReadDue, endsInServerDay } from "./schedule";
import type { V1Source } from "./sources/types";
import { SQUAD_CALLS_MAX, SQUADS_SAFETY_MARGIN, squadsReserve, type SquadsConfig } from "./squads";
import { readOne, type Batch } from "./squads-call";
import {
  forbidden,
  keyStatusOf,
  squadTargets,
  type OpenKey,
  type SquadTarget,
} from "./workspace-keys";

/** The gap between two calls: gentle on the tracker. */
export const PACE_MS = 500;

export interface SquadsDeps {
  /** fetchQuota: a workspace key's own quota, once at the start of its day (D124). */
  v1: Pick<V1Source, "fetchPlayer" | "fetchQuota">;
  now: () => Date;
  fetch: typeof fetch;
  env: SquadsConfig & Pick<Env, "LAP_SITE_BASE_URL" | "WORKSPACE_KEYS_SECRET">;
  secrets?: readonly string[];
  /** Tests pass 0. */
  paceMs?: number;
  /** RUN_DEADLINE_MS; tests pass a short one to end a batch mid-roster. */
  deadlineMs?: number;
}

export type SquadsOutcome =
  | { kind: "idle" }
  | { kind: "batch"; day: string; status: SquadRead["status"]; calls: number; more: boolean };

/**
 * A workspace key's lines carry its alliance (`union_id`); the own alliance's on our key keep D117's. Every
 * line says which workspace and alliance it counts (issue 452): the slug and the public tag.
 */
const whose = (target: SquadTarget) => ({
  ...(target.key && { union_id: target.unionId }),
  ...eventWorkspace(target),
});

/** The run's lines; a workspace key is masked in them too, on top of lib/redact's `lap_` rule. */
const logger = (deps: SquadsDeps, db: Db, day: string, target: SquadTarget) =>
  createRunLogger(
    { insertRunLog: (line) => insertRunLog(db, line) },
    {
      readDay: day,
      secrets: [...(deps.secrets ?? []), ...(target.key ? [target.key.apiKey] : [])],
      now: deps.now,
    },
  );

/**
 * The next batch of today's squads read of each alliance due (squadTargets: the own alliance first), or
 * idle: outside the daily read's window, too close to the server reset, before the day's read finished,
 * or when every alliance's day is done or has a batch running. The outcome is the first alliance's
 * status, with every batch's calls, and `more` when any has members left.
 */
export async function runSquadsBatch(deps: SquadsDeps, db: Db): Promise<SquadsOutcome> {
  const now = deps.now();
  const due = dailyReadDue(now, deps.env);
  // INVARIANT daily-read.ends-before-midnight, for the squads too: a batch ends before 00:00.
  if (!due || !endsInServerDay(now, RUN_DEADLINE_MS, deps.env)) return { kind: "idle" };
  const daily = await getDailyRead(db, due.day);
  if (!daily || daily.status === "running") return { kind: "idle" };
  // INVARIANT keys.own-quota-only: a workspace is read only on its own key; LAP_API_KEY only for the own
  // alliance (D124).
  const targets = await squadTargets(db, deps.env.WORKSPACE_KEYS_SECRET, now);
  // Each alliance on its own key and quota, at once: one alliance's 100 s never waits for another's.
  const outcomes = await Promise.all(
    targets.map((target) => targetBatch(deps, db, { day: due.day, daily, target })),
  );
  const ran = outcomes.filter((o) => o.kind === "batch");
  const [first] = ran;
  if (!first) return { kind: "idle" };
  const calls = ran.reduce((n, o) => n + o.calls, 0);
  return { ...first, calls, more: ran.some((o) => o.more) };
}

type StartDaily = { quotaRemainingBefore: number | null; callsUsed: number };

/** One alliance's next batch, on its target's key. */
async function targetBatch(
  deps: SquadsDeps,
  db: Db,
  run: { day: string; daily: StartDaily; target: SquadTarget },
): Promise<SquadsOutcome> {
  const { day, target } = run;
  const now = deps.now();
  const uids = await dayRosterUids(db, day, target.unionId);
  const log = logger(deps, db, day, target);
  const existing = await getSquadRead(db, day, target.unionId);
  if (!uids) {
    if (!existing) await log.warn("squads.skip", { ...whose(target), reason: "no_roster" });
    await log.shutdown();
    return { kind: "idle" };
  }
  // A workspace key funds none of our event reads: it keeps the safety margin only (D124).
  const reserve = target.key
    ? SQUADS_SAFETY_MARGIN
    : squadsReserve(now, deps.env, ALLIANCES.length);
  // INVARIANT run.deadline-100s: counted from before the claim and the catalog, so the whole batch stays
  // inside the route's maxDuration.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.deadlineMs ?? RUN_DEADLINE_MS);
  try {
    const stale = new Date(now.getTime() - RUN_STALE_AFTER_MS);
    const row = existing
      ? await claimSquadBatch(db, day, target.unionId, now, stale)
      : await start(deps, db, log, { ...run, uids, reserve, signal: controller.signal });
    if (!row || row.status !== "running") {
      await log.shutdown();
      return row
        ? { kind: "batch", day, status: row.status, calls: row.callsUsed, more: false }
        : { kind: "idle" };
    }
    const batch = { row, uids, reserve, target, signal: controller.signal };
    return await readBatch(deps, db, log, batch);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The quota the day's run starts from. On LAP_API_KEY no call: the day's read left this much, at most (its
 * own calls counted after its check). On a workspace key, one /quota call on that key only; its answer
 * (or its 401 or 429) is the key's status.
 */
async function startQuota(
  deps: SquadsDeps,
  db: Db,
  run: { daily: StartDaily; key: OpenKey | null; signal: AbortSignal },
): Promise<{ remaining: number | null; calls: number; reason: string | null }> {
  const { key } = run;
  if (!key) {
    const { quotaRemainingBefore: before, callsUsed } = run.daily;
    return { remaining: before === null ? null : before - callsUsed, calls: 0, reason: null };
  }
  const now = deps.now();
  try {
    const quota = await deps.v1.fetchQuota(undefined, run.signal, {
      apiKey: key.apiKey,
      maxRetries: 0,
    });
    const empty = quota.remaining <= 0;
    const status = empty ? "out_of_quota" : "ok";
    await markKey(db, key.workspaceId, key.nonce, { status, quotaRemaining: quota.remaining }, now);
    return { remaining: quota.remaining, calls: 1, reason: empty ? "key_out_of_quota" : null };
  } catch (e) {
    const status = keyStatusOf(e);
    if (status) {
      const patch = { status, ...(status === "out_of_quota" && { quotaRemaining: 0 }) };
      await markKey(db, key.workspaceId, key.nonce, patch, now);
    }
    // A 403 stops the night without marking the key; a 5xx or no answer leaves the quota unknown.
    const other = forbidden(e) ? "key_forbidden" : "quota_unknown";
    return { remaining: null, calls: 1, reason: status ? `key_${status}` : other };
  }
}

/** The day's first batch of an alliance: the claim, the quota guard for the whole run, the hero catalog. */
async function start(
  deps: SquadsDeps,
  db: Db,
  log: RunLogger,
  run: {
    day: string;
    uids: number[];
    reserve: number;
    daily: StartDaily;
    target: SquadTarget;
    signal: AbortSignal;
  },
): Promise<SquadRead | null> {
  const now = deps.now();
  const { target } = run;
  const base = { day: run.day, unionId: target.unionId, startedAt: now, members: run.uids.length };
  // The claim first: a second caller makes no quota call.
  if (!(await startSquadRead(db, { ...base, status: "running", batchAt: now }))) return null;
  const quota = await startQuota(deps, db, { ...run, key: target.key });
  const { remaining } = quota;
  const required = Math.min(run.uids.length, SQUAD_CALLS_MAX) + run.reserve;
  // INVARIANT squads.keeps-event-reserve
  const reason =
    quota.reason ?? (remaining === null ? "quota_unknown" : remaining < required ? "quota" : null);
  const patch = {
    status: reason ? ("skipped" as const) : ("running" as const),
    batchAt: reason ? null : now,
    finishedAt: reason ? now : null,
    quotaRemaining: remaining,
    callsUsed: quota.calls,
    reason,
  };
  await updateClaimedSquadRead(db, run.day, target.unionId, now, patch);
  if (reason) {
    const data = { ...whose(target), reason, quota_remaining: remaining, required };
    await log.warn("squads.skip", data);
  } else await refreshHeroCatalog(db, deps.env.LAP_SITE_BASE_URL, deps.fetch, now, log);
  return { ...base, ...patch, afterUid: null, retryUids: [], withSquads: 0, failed: 0 };
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

/** The members after `afterUid` (uid order) not read yet in this pass. */
const leftOf = (todo: readonly number[], b: Batch) =>
  todo.filter((uid) => b.afterUid === null || uid > b.afterUid);

/** The next call: the pass in uid order, then each member whose call failed with a 5xx or no answer, once. */
function nextCall(todo: readonly number[], b: Batch): { uid: number; retry: boolean } | null {
  const [main] = leftOf(todo, b);
  if (main !== undefined) return { uid: main, retry: false };
  const [again] = b.retryUids;
  return again === undefined ? null : { uid: again, retry: true };
}

/**
 * Reads members after `row.afterUid` (uid order), then retries the pass's 5xx and network failures once,
 * until done, the cap, the reserve, a 429 or the deadline.
 */
async function readBatch(
  deps: SquadsDeps,
  db: Db,
  log: RunLogger,
  run: {
    row: SquadRead;
    uids: number[];
    reserve: number;
    target: SquadTarget;
    signal: AbortSignal;
  },
): Promise<SquadsOutcome> {
  const { row, target, signal } = run;
  // The claim this batch holds: every write below is guarded by it.
  const claimedAt = row.batchAt as Date;
  // INVARIANT squads.calls-capped: every call of the day counts, retries included.
  const cap = SQUAD_CALLS_MAX;
  const todo = [...run.uids].sort((a, b) => a - b);
  const b: Batch = {
    calls: 0,
    read: 0,
    withSquads: 0,
    failed: 0,
    might: 0,
    remaining: row.quotaRemaining,
    afterUid: row.afterUid,
    retryUids: [...row.retryUids],
    retried: 0,
    stop: null,
  };
  for (let call = nextCall(todo, b); call; call = nextCall(todo, b)) {
    b.stop = stopReason(row.callsUsed + b.calls, cap, b.remaining, run.reserve);
    if (b.stop || signal.aborted) break;
    const save = () =>
      updateClaimedSquadRead(db, row.day, target.unionId, claimedAt, progress(row, b));
    const outcome = await readOne(deps, db, { ...call, target, signal }, b, save);
    // Cut by the deadline before it was sent: the member stays for the next batch.
    if (outcome === "unsent") break;
    if (outcome === "lost") {
      // A later caller took the claim as stale: it owns the day now.
      await log.shutdown();
      return { kind: "idle" };
    }
    if (b.stop) break;
    await sleep(deps.paceMs ?? PACE_MS, signal);
  }
  return finishBatch(deps, db, log, { row, todo, b, claimedAt, target });
}

/** The day's totals after this batch's calls so far. */
const progress = (row: SquadRead, b: Batch) => ({
  afterUid: b.afterUid,
  retryUids: b.retryUids,
  callsUsed: row.callsUsed + b.calls,
  withSquads: row.withSquads + b.withSquads,
  failed: row.failed + b.failed,
  quotaRemaining: b.remaining,
});

/** Why the next call may not be made: the day's cap, or a call that would cut into the reserve. */
function stopReason(calls: number, cap: number, remaining: number | null, reserve: number) {
  // INVARIANT squads.calls-capped
  if (calls >= cap) return "cap";
  // INVARIANT squads.keeps-event-reserve
  if (remaining !== null && remaining - 1 < reserve) return "quota";
  return null;
}

async function finishBatch(
  deps: SquadsDeps,
  db: Db,
  log: RunLogger,
  done: { row: SquadRead; todo: number[]; b: Batch; claimedAt: Date; target: SquadTarget },
): Promise<SquadsOutcome> {
  const { row, todo, b, target } = done;
  const left = leftOf(todo, b).length + b.retryUids.length;
  const status = b.stop ? "stopped" : left === 0 ? "done" : "running";
  const finished = status === "running" ? null : deps.now();
  const released = await updateClaimedSquadRead(db, row.day, target.unionId, done.claimedAt, {
    ...progress(row, b),
    status,
    // Released, so the next call takes the next batch at once.
    batchAt: null,
    finishedAt: finished,
    reason: b.stop,
  });
  if (!released) {
    await log.shutdown();
    return { kind: "idle" };
  }
  // The key's quota left, for its Settings screen; an empty one waits for the reset (D124). A 401 or a
  // 429 already marked the key in failedCall.
  const marked = b.stop === "key_invalid" || b.stop === "quota_429";
  if (target.key && b.remaining !== null && !marked) {
    const empty = b.remaining <= 0;
    const patch = {
      quotaRemaining: b.remaining,
      ...(empty && { status: "out_of_quota" as const }),
    };
    await markKey(db, target.key.workspaceId, target.key.nonce, patch, deps.now());
  }
  await log[b.stop ? "warn" : "info"]("squads.batch", {
    ...whose(target),
    status,
    calls: b.calls,
    players: b.read,
    with_squads: b.withSquads,
    failed: b.failed,
    retried: b.retried,
    might_written: b.might,
    left,
    quota_remaining: b.remaining,
    ...(b.stop && { reason: b.stop }),
  });
  await log.shutdown();
  return { kind: "batch", day: row.day, status, calls: b.calls, more: status === "running" };
}
