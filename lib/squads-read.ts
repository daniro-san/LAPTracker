// The squads read (D117, issue 413) as a daily queue (D132, issue 472): after the day's roster read (D72),
// every member of each read alliance's roster is queued for that quota day (00:00 UTC), and every
// cron-job.org tick reads a small batch of each alliance's queue after its answer (lib/squads-tick.ts):
// at most SQUADS_BATCH_CALLS calls and SQUADS_BATCH_MS, one GET /v1/players/{uid} per member, the tracker's
// cached copy (no `fresh`), sequential and paced. D124: OWN_ALLIANCE_ID on LAP_API_KEY until its officers
// save their own key, and every workspace with a usable key of its own on that key and its quota only,
// each alliance's batch alongside the others. A 5xx or no answer sends the member to the back of the queue
// (at most 3 attempts a day); one answer per member a day. On LAP_API_KEY nothing runs during the
// scheduled event's Before/After window, and the run never spends below `squadsReserve`: it waits, and
// goes on once the event's reads no longer need the quota. Never more than SQUAD_CALLS_MAX calls a day.
// /admin's "Run the squads read now" and POST /api/squads-read run the same batches on the same queue.
// Log lines are counts, the quota left and reasons: no names, no squads.
import { TRACKED_COUNT } from "../config/alliances";
import { eventWorkspace } from "./analytics/server";
import { RUN_STALE_AFTER_MS } from "./compute";
import type { Db } from "./db";
import type { Env } from "./env";
import { refreshHeroCatalog } from "./heroes";
import { opponentReserve } from "./kvk-reserve";
import { createRunLogger, type LogData, type RunLogger } from "./logger";
import { getDailyRead } from "./repo/daily-reads";
import { insertRunLog } from "./repo/run-logs";
import { dueMembers, queueCounts, queueMembers, saveCall } from "./repo/squad-queue";
import {
  claimSquadBatch,
  dayRosterUids,
  getSquadRead,
  startSquadRead,
  updateClaimedSquadRead,
  type SquadRead,
} from "./repo/squads";
import { markKey } from "./repo/workspace-keys";
import { inEventWindow } from "./schedule";
import type { V1Source } from "./sources/types";
import {
  SQUAD_CALLS_MAX,
  SQUADS_BATCH_CALLS,
  SQUADS_BATCH_MS,
  SQUADS_SAFETY_MARGIN,
  squadsQueueDay,
  squadsReserve,
  type SquadsConfig,
} from "./squads";
import { readOne, startQuota, type Batch, type StartDaily } from "./squads-call";
import { squadTargets, type SquadTarget } from "./workspace-keys";

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
  /** SQUADS_BATCH_MS; tests pass a short one to end a batch mid-queue. */
  deadlineMs?: number;
}

/** An /admin press (D117, amendment 2026-11-19b): `force` marks its lines; `unionId` reads one alliance. */
export interface SquadsRun {
  force?: boolean;
  unionId?: number;
  /** D137: Friday night's Raid Shield burst reads the alliances whose shield check is on. */
  shield?: boolean;
  /** The burst's alliances: those whose night time has come (issue 859). */
  unionIds?: readonly number[];
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

/**
 * The run's lines; a workspace key is masked in them too, on top of lib/redact's `lap_` rule. A press's
 * lines carry `forced: true` (D117, amendment 2026-11-19b).
 */
const logger = (
  deps: SquadsDeps,
  db: Db,
  run: { day: string; target: SquadTarget; forced: boolean },
) =>
  createRunLogger(
    {
      insertRunLog: (line) =>
        insertRunLog(
          db,
          run.forced ? { ...line, data: { ...(line.data as LogData), forced: true } } : line,
        ),
    },
    {
      readDay: run.day,
      secrets: [...(deps.secrets ?? []), ...(run.target.key ? [run.target.key.apiKey] : [])],
      now: deps.now,
    },
  );

/**
 * The next batch of each alliance's queue of the current quota day, or idle: a batch would cross the
 * quota reset, the day's read has not finished, or every alliance's day is over, waiting or has a batch
 * running. The outcome is the first alliance's status, with every batch's calls, and `more` when any has
 * members whose turn has come.
 */
export async function runSquadsBatch(
  deps: SquadsDeps,
  db: Db,
  run: SquadsRun = {},
): Promise<SquadsOutcome> {
  const now = deps.now();
  const day = squadsQueueDay(now, deps.env);
  if (!day) return { kind: "idle" };
  const daily = await getDailyRead(db, day);
  if (!daily || daily.status === "running") return { kind: "idle" };
  // INVARIANT squads.event-pause: on LAP_API_KEY nothing runs from a window's Before until its After's
  // window closes (samples included), in each of the event's windows (D160); a workspace key funds none of
  // our event reads (D124).
  const eventOn = inEventWindow(now, deps.env);
  // INVARIANT keys.own-quota-only: a workspace is read only on its own key; LAP_API_KEY only for the own
  // alliance (D124), or for a workspace whose saved key is LAP_API_KEY itself (issue 855): any workspace,
  // the own alliance's or another's, holding the site key is read on it for its OWN alliance only, under
  // the site reserve and the event pause (`key: null`).
  const feature = run.shield ? "shield_check" : "squads";
  const targets = (await squadTargets(db, deps.env.WORKSPACE_KEYS_SECRET, now, feature)).filter(
    (t) =>
      (run.unionId === undefined || t.unionId === run.unionId) &&
      (run.unionIds === undefined || run.unionIds.includes(t.unionId)) &&
      (t.key || !eventOn),
  );
  const forced = run.force === true;
  // Each alliance on its own key and quota, at once: one alliance's batch never waits for another's.
  const outcomes = await Promise.all(
    targets.map((target) => targetBatch(deps, db, { day, daily, target, forced })),
  );
  const ran = outcomes.filter((o) => o.kind === "batch");
  const [first] = ran;
  if (!first) return { kind: "idle" };
  const calls = ran.reduce((n, o) => n + o.calls, 0);
  return { ...first, calls, more: ran.some((o) => o.more) };
}

/** One alliance's next batch, on its target's key. */
async function targetBatch(
  deps: SquadsDeps,
  db: Db,
  run: { day: string; daily: StartDaily; target: SquadTarget; forced: boolean },
): Promise<SquadsOutcome> {
  const { day, target } = run;
  const now = deps.now();
  const uids = await dayRosterUids(db, day, target.unionId);
  const log = logger(deps, db, run);
  const existing = await getSquadRead(db, day, target.unionId);
  if (!uids) {
    if (!existing) await log.warn("squads.skip", { ...whose(target), reason: "no_roster" });
    await log.shutdown();
    return { kind: "idle" };
  }
  // A workspace key funds none of our event reads: it keeps the safety margin only (D124).
  // D152: the KvK opponent's calls still due, on its quota day only.
  const reserve = target.key
    ? SQUADS_SAFETY_MARGIN
    : squadsReserve(now, deps.env, TRACKED_COUNT, await opponentReserve(db, now, deps.env));
  // Counted from before the claim and the catalog, so the whole batch stays well inside maxDuration.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.deadlineMs ?? SQUADS_BATCH_MS);
  try {
    const stale = new Date(now.getTime() - RUN_STALE_AFTER_MS);
    const row = existing
      ? await claimSquadBatch(db, day, target.unionId, now, stale)
      : await start(deps, db, log, { ...run, uids, signal: controller.signal });
    if (!row || row.status !== "running") {
      await log.shutdown();
      return row
        ? { kind: "batch", day, status: row.status, calls: row.callsUsed, more: false }
        : { kind: "idle" };
    }
    // The day's roster is in the queue: a no-op once it is, and the first batch's work otherwise. Members
    // of the roster go before anyone who joined later or waits for another attempt.
    await queueMembers(db, { day, unionId: target.unionId }, uids, row.startedAt);
    const batch = {
      row,
      reserve,
      target,
      rosterAt: run.daily.startedAt,
      queued: new Set(uids),
      signal: controller.signal,
    };
    return await readBatch(deps, db, log, batch);
  } finally {
    clearTimeout(timer);
  }
}

/** The day's first batch of an alliance: the claim, its starting quota, the hero catalog. */
async function start(
  deps: SquadsDeps,
  db: Db,
  log: RunLogger,
  run: {
    day: string;
    uids: number[];
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
  // A key that cannot read today, or a quota nobody knows, skips the day. Too little quota is not a
  // skip any more (D132): the reserve guard before each call waits, and the queue goes on later.
  const reason = quota.reason ?? (remaining === null ? "quota_unknown" : null);
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
    await log.warn("squads.skip", { ...whose(target), reason, quota_remaining: remaining });
  } else await refreshHeroCatalog(db, deps.env.LAP_SITE_BASE_URL, deps.fetch, now, log);
  return { ...base, ...patch, withSquads: 0, failed: 0 };
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

/**
 * Reads the members whose turn has come, the longest waiting first, until the batch's size, the day's cap,
 * the reserve, a 429 or a key problem, or the deadline.
 */
async function readBatch(
  deps: SquadsDeps,
  db: Db,
  log: RunLogger,
  run: {
    row: SquadRead;
    reserve: number;
    target: SquadTarget;
    rosterAt: Date;
    queued: Set<number>;
    signal: AbortSignal;
  },
): Promise<SquadsOutcome> {
  const { row, target, signal, rosterAt, queued } = run;
  // The claim this batch holds: every write below is guarded by it.
  const claimedAt = row.batchAt as Date;
  const q = { day: row.day, unionId: target.unionId };
  const due = await dueMembers(db, q, deps.now(), SQUADS_BATCH_CALLS);
  const b: Batch = {
    calls: 0,
    read: 0,
    withSquads: 0,
    failed: 0,
    might: 0,
    joined: 0,
    remaining: row.quotaRemaining,
    stop: null,
  };
  let wait: string | null = null;
  for (const member of due) {
    const why = stopReason(row.callsUsed + b.calls, b.remaining, run.reserve);
    // INVARIANT squads.calls-capped ends the day; the reserve only waits (D132).
    if (why === "cap") b.stop = why;
    wait = why === "quota" ? why : null;
    if (why || signal.aborted) break;
    const save = (m: Parameters<typeof saveCall>[3]) =>
      saveCall(db, { ...q, claimedAt }, progress(row, b), m);
    const call = { ...member, target, signal, day: row.day, rosterAt, queued };
    const outcome = await readOne(deps, db, call, b, save);
    // Cut by the deadline before it was sent: the member keeps its turn for the next batch.
    if (outcome === "unsent") break;
    if (outcome === "lost") {
      // A later caller took the claim as stale: it owns the day now.
      await log.shutdown();
      return { kind: "idle" };
    }
    if (b.stop) break;
    await sleep(deps.paceMs ?? PACE_MS, signal);
  }
  return finishBatch(deps, db, log, { row, b, wait, claimedAt, target });
}

/** The day's totals after this batch's calls so far. */
const progress = (row: SquadRead, b: Batch) => ({
  callsUsed: row.callsUsed + b.calls,
  withSquads: row.withSquads + b.withSquads,
  failed: row.failed + b.failed,
  quotaRemaining: b.remaining,
});

/** Why the next call may not be made: the day's cap, or a call that would cut into the reserve. */
function stopReason(calls: number, remaining: number | null, reserve: number) {
  // INVARIANT squads.calls-capped
  if (calls >= SQUAD_CALLS_MAX) return "cap";
  // INVARIANT squads.keeps-event-reserve
  if (remaining !== null && remaining - 1 < reserve) return "quota";
  return null;
}

async function finishBatch(
  deps: SquadsDeps,
  db: Db,
  log: RunLogger,
  done: { row: SquadRead; b: Batch; wait: string | null; claimedAt: Date; target: SquadTarget },
): Promise<SquadsOutcome> {
  const { row, b, target } = done;
  const now = deps.now();
  // The queue holds at least the day's roster by now.
  const [counts = { waiting: 0, dueNow: 0 }] = await queueCounts(db, row.day, now, target.unionId);
  const status = b.stop ? "stopped" : counts.waiting === 0 ? "done" : "running";
  const reason = b.stop ?? done.wait;
  const released = await updateClaimedSquadRead(db, row.day, target.unionId, done.claimedAt, {
    ...progress(row, b),
    status,
    // Released, so the next tick (or a press) takes the next batch.
    batchAt: null,
    finishedAt: status === "running" ? null : now,
    reason,
  });
  if (!released) {
    await log.shutdown();
    return { kind: "idle" };
  }
  await keepKeyQuota(deps, db, target, b);
  // A batch that made no call and ended nothing (a wait for the reserve or for a retry's turn) logs
  // nothing: the next tick tries again.
  if (b.calls > 0 || status !== "running")
    await logBatch(log, target, b, { status, left: counts.waiting, reason });
  await log.shutdown();
  const more = status === "running" && counts.dueNow > 0 && done.wait === null;
  return { kind: "batch", day: row.day, status, calls: b.calls, more };
}

/** The batch's `squads.batch` line: counts, the quota left and a reason; never a member. */
function logBatch(
  log: RunLogger,
  target: SquadTarget,
  b: Batch,
  end: { status: string; left: number; reason: string | null },
) {
  return log[b.stop ? "warn" : "info"]("squads.batch", {
    ...whose(target),
    status: end.status,
    calls: b.calls,
    players: b.read,
    with_squads: b.withSquads,
    failed: b.failed,
    joined: b.joined,
    might_written: b.might,
    left: end.left,
    quota_remaining: b.remaining,
    ...(end.reason && { reason: end.reason }),
  });
}

/**
 * The key's quota left, for its Settings screen; an empty one waits for the reset (D124). A 401 or a 429
 * already marked the key in the failed call.
 */
async function keepKeyQuota(deps: SquadsDeps, db: Db, target: SquadTarget, b: Batch) {
  const marked = b.stop === "key_invalid" || b.stop === "quota_429";
  if (!target.key || b.remaining === null || marked || b.calls === 0) return;
  const empty = b.remaining <= 0;
  const patch = { quotaRemaining: b.remaining, ...(empty && { status: "out_of_quota" as const }) };
  await markKey(db, target.key.workspaceId, target.key.nonce, patch, deps.now());
}
