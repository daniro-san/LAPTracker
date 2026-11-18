// The nightly squads read (D117, issue 413): after the day's roster read (D72), one GET /v1/players/{uid}
// per member of OWN_ALLIANCE_ID's roster, the tracker's cached copy (no `fresh`), sequential and paced. It
// runs in batches of at most RUN_DEADLINE_MS: POST /api/squads-read takes the next batch, and the tick
// workflow calls it again while batches remain. Each batch starts only when it ends inside the server day
// (nothing after 23:58:20). The run never spends below `squadsReserve` (the event's quota day keeps its
// reads), makes one call per member in the pass plus at most one retry for a 5xx or no answer (the
// cursor and the retry list are saved after every call, under the batch's claim), and never makes more
// calls in a day than SQUAD_CALLS_MAX, retries included. Its log lines are counts, the quota left and
// reasons: no names, no squads.
import { ALLIANCES, OWN_ALLIANCE_ID } from "../config/alliances";
import { RUN_DEADLINE_MS, RUN_STALE_AFTER_MS } from "./compute";
import type { Db } from "./db";
import type { Env } from "./env";
import { refreshHeroCatalog } from "./heroes";
import { createRunLogger, type RunLogger } from "./logger";
import { getDailyRead } from "./repo/daily-reads";
import { factVersion, insertFact } from "./repo/member-facts";
import { insertRunLog } from "./repo/run-logs";
import {
  claimSquadBatch,
  dayRosterUids,
  getSquadRead,
  latestSquads,
  startSquadRead,
  storeSquads,
  updateClaimedSquadRead,
  workspaceIdOf,
  type SquadRead,
} from "./repo/squads";
import { dailyReadDue, endsInServerDay } from "./schedule";
import {
  QuotaExhaustedError,
  RequestError,
  UpstreamError,
  type PlayerSquadsInput,
  type V1Source,
} from "./sources/types";
import {
  mainSquad,
  SQUAD_CALLS_MAX,
  squadsReserve,
  trackerMightWrite,
  type SquadsConfig,
} from "./squads";

/** The gap between two calls: gentle on the tracker. */
export const PACE_MS = 500;

export interface SquadsDeps {
  v1: Pick<V1Source, "fetchPlayer">;
  now: () => Date;
  fetch: typeof fetch;
  env: SquadsConfig & Pick<Env, "LAP_SITE_BASE_URL">;
  secrets?: readonly string[];
  /** Tests pass 0. */
  paceMs?: number;
  /** RUN_DEADLINE_MS; tests pass a short one to end a batch mid-roster. */
  deadlineMs?: number;
}

export type SquadsOutcome =
  | { kind: "idle" }
  | { kind: "batch"; day: string; status: SquadRead["status"]; calls: number; more: boolean };

/** One batch's counts, carried into the day's row. */
interface Batch {
  calls: number;
  read: number;
  withSquads: number;
  failed: number;
  might: number;
  remaining: number | null;
  afterUid: number | null;
  /** Members to retry once after the pass (a 5xx or no answer). */
  retryUids: number[];
  retried: number;
  stop: string | null;
}

const logger = (deps: SquadsDeps, db: Db, day: string) =>
  createRunLogger(
    { insertRunLog: (line) => insertRunLog(db, line) },
    { readDay: day, secrets: deps.secrets ?? [], now: deps.now },
  );

/**
 * The next batch of today's squads read, or idle: outside the daily read's window, too close to the
 * server reset, before the day's read finished, when the day is done, or while another batch runs.
 */
export async function runSquadsBatch(deps: SquadsDeps, db: Db): Promise<SquadsOutcome> {
  const now = deps.now();
  const due = dailyReadDue(now, deps.env);
  // INVARIANT daily-read.ends-before-midnight, for the squads too: a batch ends before 00:00.
  if (!due || !endsInServerDay(now, RUN_DEADLINE_MS, deps.env)) return { kind: "idle" };
  const daily = await getDailyRead(db, due.day);
  if (!daily || daily.status === "running") return { kind: "idle" };
  const uids = await dayRosterUids(db, due.day, OWN_ALLIANCE_ID);
  const log = logger(deps, db, due.day);
  const existing = await getSquadRead(db, due.day);
  if (!uids) {
    if (!existing) await log.warn("squads.skip", { reason: "no_roster" });
    await log.shutdown();
    return { kind: "idle" };
  }
  const reserve = squadsReserve(now, deps.env, ALLIANCES.length);
  // INVARIANT run.deadline-100s: counted from before the claim and the catalog, so the whole batch stays
  // inside the route's maxDuration.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.deadlineMs ?? RUN_DEADLINE_MS);
  try {
    const row = existing
      ? await claimSquadBatch(db, due.day, now, new Date(now.getTime() - RUN_STALE_AFTER_MS))
      : await start(deps, db, log, { day: due.day, uids, reserve, daily });
    if (!row || row.status !== "running") {
      await log.shutdown();
      return row
        ? { kind: "batch", day: due.day, status: row.status, calls: 0, more: false }
        : { kind: "idle" };
    }
    return await readBatch(deps, db, log, { row, uids, reserve, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** The day's first batch: the quota guard for the whole run, the claim, the hero catalog. */
async function start(
  deps: SquadsDeps,
  db: Db,
  log: RunLogger,
  run: {
    day: string;
    uids: number[];
    reserve: number;
    daily: { quotaRemainingBefore: number | null; callsUsed: number };
  },
): Promise<SquadRead | null> {
  const now = deps.now();
  const { quotaRemainingBefore: before, callsUsed } = run.daily;
  // No quota call: the day's read left this much, at most (its own calls counted after its check).
  const remaining = before === null ? null : before - callsUsed;
  const required = Math.min(run.uids.length, SQUAD_CALLS_MAX) + run.reserve;
  // INVARIANT squads.keeps-event-reserve
  const reason = remaining === null ? "quota_unknown" : remaining < required ? "quota" : null;
  const row = {
    day: run.day,
    unionId: OWN_ALLIANCE_ID,
    status: reason ? ("skipped" as const) : ("running" as const),
    startedAt: now,
    batchAt: reason ? null : now,
    finishedAt: reason ? now : null,
    members: run.uids.length,
    quotaRemaining: remaining,
    reason,
  };
  if (!(await startSquadRead(db, row))) return null;
  if (reason) await log.warn("squads.skip", { reason, quota_remaining: remaining, required });
  else await refreshHeroCatalog(db, deps.env.LAP_SITE_BASE_URL, deps.fetch, now, log);
  return { ...row, afterUid: null, retryUids: [], callsUsed: 0, withSquads: 0, failed: 0 };
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
  run: { row: SquadRead; uids: number[]; reserve: number; signal: AbortSignal },
): Promise<SquadsOutcome> {
  const { row, signal } = run;
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
  const workspaceId = await workspaceIdOf(db, OWN_ALLIANCE_ID);
  for (let call = nextCall(todo, b); call; call = nextCall(todo, b)) {
    b.stop = stopReason(row.callsUsed + b.calls, cap, b.remaining, run.reserve);
    if (b.stop || signal.aborted) break;
    const save = () => updateClaimedSquadRead(db, row.day, claimedAt, progress(row, b));
    const outcome = await readOne(deps, db, { ...call, workspaceId, signal }, b, save);
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
  return finishBatch(deps, db, log, { row, todo, b, claimedAt });
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

/** A failure worth one more call after the pass: a 5xx, or no answer at all. Never a 429 or another 4xx. */
const retryable = (e: unknown) =>
  e instanceof RequestError || (e instanceof UpstreamError && e.status >= 500);

/** "unsent": the deadline came before the call; "lost": the claim was taken over; "done": go on. */
type CallOutcome = "unsent" | "lost" | "done";

/**
 * One call for one member (the adapter itself never retries it), then the squads stored and the main
 * squad's version when due. In the pass, a 5xx, no answer, or the deadline cutting a call already sent
 * puts the member on the retry list; a retry takes them off it whatever its answer. `save` writes the
 * cursor and the counts under the batch's claim.
 */
async function readOne(
  deps: SquadsDeps,
  db: Db,
  call: { uid: number; retry: boolean; workspaceId: number | null; signal: AbortSignal },
  b: Batch,
  save: () => Promise<boolean>,
): Promise<CallOutcome> {
  let sent = false;
  const onAttempt = () => {
    sent = true;
    b.calls++;
  };
  let player: PlayerSquadsInput;
  try {
    player = await deps.v1.fetchPlayer(call.uid, onAttempt, call.signal, { maxRetries: 0 });
  } catch (e) {
    if (!sent) return "unsent";
    failedCall(e, call, b);
    moveOn(call, b);
    return (await save()) ? "done" : "lost";
  }
  b.remaining = player.quota?.remaining ?? (b.remaining === null ? null : b.remaining - 1);
  b.read++;
  if (player.squads.length > 0) b.withSquads++;
  moveOn(call, b);
  // INVARIANT squads.once-per-member: the cursor and the call are saved as soon as the answer is in, so a
  // function killed while storing never makes the next batch call this member again.
  if (!(await save())) return "lost";
  const now = deps.now();
  await storeSquads(db, OWN_ALLIANCE_ID, call.uid, player.squads, now);
  if (call.workspaceId !== null && (await writeMight(db, call.workspaceId, call.uid, now)))
    b.might++;
  return "done";
}

/**
 * A call that was sent and failed. A 429 ends the day's read: the quota is spent. A 5xx (5 to 6 of 100
 * members on 2026-11-18), no answer, or the run's deadline cutting the call gets one retry after the pass
 * (owner); if that fails too, the member's stored squads stay as they are until tomorrow.
 */
function failedCall(
  e: unknown,
  call: { uid: number; retry: boolean; signal: AbortSignal },
  b: Batch,
) {
  if (e instanceof QuotaExhaustedError) b.stop = "quota_429";
  else b.failed++;
  if (!call.retry && (retryable(e) || call.signal.aborted)) b.retryUids.push(call.uid);
}

/** INVARIANT squads.once-per-member: one call in the pass, at most one retry, whatever the answers. */
function moveOn(call: { uid: number; retry: boolean }, b: Batch): void {
  if (call.retry) {
    b.retryUids = b.retryUids.filter((uid) => uid !== call.uid);
    b.retried++;
  } else b.afterUid = call.uid;
}

/** The tracker's main squad as the next "Main squad might" version, when trackerMightWrite allows it. */
async function writeMight(db: Db, workspaceId: number, uid: number, now: Date): Promise<boolean> {
  const main = mainSquad(await latestSquads(db, OWN_ALLIANCE_ID, uid));
  if (!main) return false;
  const newest = await factVersion(db, workspaceId, uid, "squadMight", "newest");
  if (!trackerMightWrite(newest, main)) return false;
  return insertFact(db, {
    workspaceId,
    uid,
    field: "squadMight",
    version: (newest?.version ?? 0) + 1,
    value: main.power,
    source: "tracker",
    writtenBy: null,
    writtenAt: now,
  });
}

async function finishBatch(
  deps: SquadsDeps,
  db: Db,
  log: RunLogger,
  done: { row: SquadRead; todo: number[]; b: Batch; claimedAt: Date },
): Promise<SquadsOutcome> {
  const { row, todo, b } = done;
  const left = leftOf(todo, b).length + b.retryUids.length;
  const status = b.stop ? "stopped" : left === 0 ? "done" : "running";
  const finished = status === "running" ? null : deps.now();
  const released = await updateClaimedSquadRead(db, row.day, done.claimedAt, {
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
  await log[b.stop ? "warn" : "info"]("squads.batch", {
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
