// The nightly squads read (D117, issue 413): after the day's roster read (D72), one GET /v1/players/{uid}
// per member of OWN_ALLIANCE_ID's roster, the tracker's cached copy (no `fresh`), sequential and paced. It
// runs in batches of at most RUN_DEADLINE_MS: POST /api/squads-read takes the next batch, and the tick
// workflow calls it again while batches remain. Each batch starts only when it ends inside the server day
// (nothing after 23:58:20). The run never spends below `squadsReserve` (the event's quota day keeps its
// reads), never reads a member twice in a day, and never makes more calls than the roster has members
// (SQUAD_CALLS_MAX at most). Its log lines are counts, the quota left and reasons: no names, no squads.
import { ALLIANCES, OWN_ALLIANCE_ID } from "../config/alliances";
import { RUN_DEADLINE_MS, RUN_STALE_AFTER_MS } from "./compute";
import type { Db } from "./db";
import type { Env } from "./env";
import { CATALOG_MAX_AGE_MS, fetchHeroCatalog } from "./heroes";
import { createRunLogger, type RunLogger } from "./logger";
import { getDailyRead } from "./repo/daily-reads";
import { catalogUpdatedAt, saveHeroCatalog } from "./repo/hero-catalog";
import { factVersion, insertFact } from "./repo/member-facts";
import { insertRunLog } from "./repo/run-logs";
import {
  claimSquadBatch,
  dayRosterUids,
  getSquadRead,
  latestSquads,
  startSquadRead,
  storeSquads,
  updateSquadRead,
  workspaceIdOf,
  type SquadRead,
} from "./repo/squads";
import { dailyReadDue, endsInServerDay } from "./schedule";
import { QuotaExhaustedError, type V1Source } from "./sources/types";
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
  const row = existing
    ? await claimSquadBatch(db, due.day, now, new Date(now.getTime() - RUN_STALE_AFTER_MS))
    : await start(deps, db, log, { day: due.day, uids, reserve, daily });
  if (!row || row.status !== "running") {
    await log.shutdown();
    return row
      ? { kind: "batch", day: due.day, status: row.status, calls: 0, more: false }
      : { kind: "idle" };
  }
  return readBatch(deps, db, log, { row, uids, reserve });
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
  else await refreshCatalog(deps, db, log);
  return { ...row, afterUid: null, callsUsed: 0, withSquads: 0, failed: 0 };
}

/** The hero catalog, when it is empty or older than CATALOG_MAX_AGE_MS. A failure keeps the old one. */
async function refreshCatalog(deps: SquadsDeps, db: Db, log: RunLogger): Promise<void> {
  const now = deps.now();
  const at = await catalogUpdatedAt(db);
  if (at && now.getTime() - at.getTime() < CATALOG_MAX_AGE_MS) return;
  const result = await fetchHeroCatalog(deps.env.LAP_SITE_BASE_URL, deps.fetch);
  if ("failure" in result) {
    await log.warn("squads.heroes", { failure: result.failure });
    return;
  }
  await saveHeroCatalog(db, result.heroes, now);
  await log.info("squads.heroes", { heroes: result.heroes.length });
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

/** Reads members after `row.afterUid` (uid order) until done, the cap, the reserve, a 429 or the deadline. */
async function readBatch(
  deps: SquadsDeps,
  db: Db,
  log: RunLogger,
  run: { row: SquadRead; uids: number[]; reserve: number },
): Promise<SquadsOutcome> {
  const { row } = run;
  const cap = Math.min(row.members, SQUAD_CALLS_MAX);
  const todo = [...run.uids]
    .sort((a, b) => a - b)
    .filter((uid) => row.afterUid === null || uid > row.afterUid);
  const b: Batch = {
    calls: 0,
    read: 0,
    withSquads: 0,
    failed: 0,
    might: 0,
    remaining: row.quotaRemaining,
    afterUid: row.afterUid,
    stop: null,
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RUN_DEADLINE_MS);
  const workspaceId = await workspaceIdOf(db, OWN_ALLIANCE_ID);
  try {
    for (const uid of todo) {
      b.stop = stopReason(row.callsUsed + b.calls, cap, b.remaining, run.reserve);
      if (b.stop || controller.signal.aborted) break;
      await readOne(deps, db, { uid, workspaceId, signal: controller.signal }, b);
      if (b.stop) break;
      await sleep(deps.paceMs ?? PACE_MS, controller.signal);
    }
  } finally {
    clearTimeout(timer);
  }
  return finishBatch(deps, db, log, { row, todo, b });
}

/** Why the next call may not be made: the day's cap, or a call that would cut into the reserve. */
function stopReason(calls: number, cap: number, remaining: number | null, reserve: number) {
  // INVARIANT squads.calls-capped
  if (calls >= cap) return "cap";
  // INVARIANT squads.keeps-event-reserve
  if (remaining !== null && remaining - 1 < reserve) return "quota";
  return null;
}

/** One member: one call (never retried), the squads stored, the main squad's version when due. */
async function readOne(
  deps: SquadsDeps,
  db: Db,
  call: { uid: number; workspaceId: number | null; signal: AbortSignal },
  b: Batch,
): Promise<void> {
  try {
    const player = await deps.v1.fetchPlayer(call.uid, () => void b.calls++, call.signal, {
      maxRetries: 0,
    });
    b.remaining = player.quota?.remaining ?? (b.remaining === null ? null : b.remaining - 1);
    b.read++;
    if (player.squads.length > 0) b.withSquads++;
    const now = deps.now();
    await storeSquads(db, OWN_ALLIANCE_ID, call.uid, player.squads, now);
    if (call.workspaceId !== null && (await writeMight(db, call.workspaceId, call.uid, now)))
      b.might++;
  } catch (e) {
    // A 429 ends the day's read: the quota is spent.
    if (e instanceof QuotaExhaustedError) b.stop = "quota_429";
    else b.failed++;
  }
  // Read or not, a member gets one call a day: the next batch goes on after them.
  b.afterUid = call.uid;
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
  done: { row: SquadRead; todo: number[]; b: Batch },
): Promise<SquadsOutcome> {
  const { row, todo, b } = done;
  const left = todo.filter((uid) => b.afterUid === null || uid > b.afterUid).length;
  const status = b.stop ? "stopped" : left === 0 ? "done" : "running";
  const finished = status === "running" ? null : deps.now();
  await updateSquadRead(db, row.day, {
    status,
    // Released, so the next call takes the next batch at once.
    batchAt: null,
    finishedAt: finished,
    afterUid: b.afterUid,
    callsUsed: row.callsUsed + b.calls,
    withSquads: row.withSquads + b.withSquads,
    failed: row.failed + b.failed,
    quotaRemaining: b.remaining,
    reason: b.stop,
  });
  await log[b.stop ? "warn" : "info"]("squads.batch", {
    status,
    calls: b.calls,
    players: b.read,
    with_squads: b.withSquads,
    failed: b.failed,
    might_written: b.might,
    left,
    quota_remaining: b.remaining,
    ...(b.stop && { reason: b.stop }),
  });
  await log.shutdown();
  return { kind: "batch", day: row.day, status, calls: b.calls, more: status === "running" };
}
