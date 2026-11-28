// The Raid Shield check's two reads (issue 474, D137), on D132's call path: one GET /v1/players/{uid} per
// member on the alliance's own key (D124), no `fresh` (it does not refresh the map scan), sequential and
// paced, the reserve kept, at most 120 calls a read. Only alliances whose `shield_check` is on (D134).
//
// - Friday from the alliance's night time (23:30 ST by default, issue 859): the quota day's squads queue
//   (D132) read as one burst of batches, so the burst IS that day's squads read and nobody is read twice
//   that night. It stops before 00:00 ST.
// - Saturday from the alliance's morning time (10:00–11:00 ST): every member once more, from a queue of its
//   own (`shield_queue`), until 12:00 ST at the latest, when KvK starts.
//
// After each read's work on a tick, the leaders' channel summary is posted or edited (lib/shield-post.ts).
// Log lines are counts, the quota left and reasons: no names, no shield values (D71).
import { TRACKED_COUNT } from "../config/alliances";
import { RUN_STALE_AFTER_MS } from "./compute";
import type { Db } from "./db";
import { opponentReserve } from "./kvk-reserve";
import { createRunLogger, type RunLogger } from "./logger";
import { getDailyRead } from "./repo/daily-reads";
import { insertRunLog } from "./repo/run-logs";
import {
  claimMorning,
  dueShield,
  noteNight,
  queueShield,
  saveShieldCall,
  shieldWaiting,
  updateMorning,
  type ShieldSettingsRow,
} from "./repo/shield-checks";
import { dayRosterUids, getSquadRead } from "./repo/squads";
import { SHIELD_CALLS_MAX, shieldPassAt, timesOf } from "./shield-check";
import { SQUADS_BATCH_CALLS, SQUADS_BATCH_MS, SQUADS_SAFETY_MARGIN, squadsReserve } from "./squads";
import { readOne, startQuota, type Batch, type StartDaily } from "./squads-call";
import { PACE_MS, runSquadsBatch, type SquadsDeps } from "./squads-read";
import type { SquadTarget } from "./workspace-keys";

/** A shield target: the squads read's target and the alliance's own settings. */
export type ShieldTarget = SquadTarget & { settings: ShieldSettingsRow | null };

/**
 * Friday's burst: batches of the squads queue for the shield-check alliances until nobody's turn has come,
 * a batch makes no call, or the next batch could end after `until` (00:00 ST, or the tick's budget).
 */
export async function shieldNight(
  deps: SquadsDeps,
  db: Db,
  run: { day: string; targets: ShieldTarget[]; until: number },
): Promise<void> {
  const now = deps.now();
  for (const t of run.targets) await noteNight(db, { day: run.day, unionId: t.unionId }, now);
  for (;;) {
    if (deps.now().getTime() + SQUADS_BATCH_MS > run.until) return;
    // Only the alliances whose night time has come: another's waits for its own (issue 859).
    const unionIds = run.targets.map((t) => t.unionId);
    const outcome = await runSquadsBatch(deps, db, { shield: true, unionIds });
    if (outcome.kind === "idle" || !outcome.more || outcome.calls === 0) return;
  }
}

/** Saturday morning's read of one alliance, on this tick: until done, stopped or `until`. */
export async function shieldMorning(
  deps: SquadsDeps,
  db: Db,
  run: { day: string; target: ShieldTarget; until: number },
): Promise<void> {
  const { day, target } = run;
  const q = { day, unionId: target.unionId };
  const now = deps.now();
  const claim = await claimMorning(db, q, now, new Date(now.getTime() - RUN_STALE_AFTER_MS));
  if (!claim) return;
  const claimedAt = claim.row.morningBatchAt as Date;
  const controller = new AbortController();
  // The claim goes stale after 150 s: the tick's share ends well before, and before 12:00 ST.
  const budget = Math.min(run.until - now.getTime(), RUN_STALE_AFTER_MS - 10_000);
  const timer = setTimeout(() => controller.abort(), Math.max(0, budget));
  const log = createRunLogger(
    { insertRunLog: (line) => insertRunLog(db, line) },
    {
      readDay: day,
      secrets: [...(deps.secrets ?? []), ...(target.key ? [target.key.apiKey] : [])],
      now: deps.now,
    },
  );
  try {
    const remaining = claim.fresh
      ? await startMorning(deps, db, { ...q, claimedAt, target, signal: controller.signal })
      : claim.row.morningQuotaRemaining;
    if (remaining === undefined) return;
    const b = await readMorning(deps, db, {
      ...q,
      claimedAt,
      target,
      calls: claim.row.morningCalls + (claim.fresh && target.key ? 1 : 0),
      remaining,
      until: run.until,
      signal: controller.signal,
    });
    await finishMorning(deps, db, log, { ...q, claimedAt, target, b });
  } finally {
    clearTimeout(timer);
    await log.shutdown();
  }
}

/** Releases the claim with the read's state, and logs its counts: never a member. */
async function finishMorning(
  deps: SquadsDeps,
  db: Db,
  log: RunLogger,
  run: { day: string; unionId: number; claimedAt: Date; target: ShieldTarget; b: Batch },
) {
  const { b } = run;
  const q = { day: run.day, unionId: run.unionId };
  const left = await shieldWaiting(db, q, deps.now());
  const status = b.stop ? "stopped" : left.waiting === 0 ? "done" : "running";
  const patch = {
    morningStatus: status,
    morningBatchAt: null,
    morningFinishedAt: status === "running" ? null : deps.now(),
    morningReason: b.stop,
  } as const;
  await updateMorning(db, { ...q, claimedAt: run.claimedAt }, patch);
  if (b.calls === 0 && status === "running") return;
  await log[b.stop ? "warn" : "info"]("shield.morning", {
    union_id: run.unionId,
    status,
    calls: b.calls,
    players: b.read,
    failed: b.failed,
    left: left.waiting,
    quota_remaining: b.remaining,
    ...(b.stop && { reason: b.stop }),
  });
}

type MorningRun = {
  day: string;
  unionId: number;
  claimedAt: Date;
  target: ShieldTarget;
  signal: AbortSignal;
};

/**
 * The morning's first batch: the day's roster queued, and the quota it starts from. Our key: what the
 * squads read left that day (or the daily read's estimate); a workspace key: one /quota call on it (D124).
 * Undefined when the read is skipped: no roster, or a key that cannot read.
 */
async function startMorning(deps: SquadsDeps, db: Db, run: MorningRun) {
  const q = { day: run.day, unionId: run.unionId };
  const uids = await dayRosterUids(db, run.day, run.unionId);
  const daily = await getDailyRead(db, run.day);
  let reason: string | null = uids && daily ? null : "no_roster";
  let remaining: number | null = null;
  let calls = 0;
  if (!reason && daily) {
    const quota = await startQuota(deps, db, {
      daily: daily as StartDaily,
      key: run.target.key,
      signal: run.signal,
    });
    const squads = run.target.key ? null : await getSquadRead(db, run.day, run.unionId);
    remaining = squads?.quotaRemaining ?? quota.remaining;
    calls = quota.calls;
    reason = quota.reason ?? (remaining === null ? "quota_unknown" : null);
  }
  if (reason) {
    const at = deps.now();
    await updateMorning(
      db,
      { ...q, claimedAt: run.claimedAt },
      {
        morningStatus: "skipped",
        morningBatchAt: null,
        morningFinishedAt: at,
        morningCalls: calls,
        morningReason: reason,
      },
    );
    return undefined;
  }
  await queueShield(db, q, uids ?? [], run.claimedAt);
  await updateMorning(
    db,
    { ...q, claimedAt: run.claimedAt },
    { morningCalls: calls, morningQuotaRemaining: remaining },
  );
  return remaining;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (ms <= 0 || signal.aborted) return resolve();
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(timer), resolve()), { once: true });
  });

/**
 * Whether the next call may not be made: the read's cap ends it (INVARIANT shield.calls-capped); a call that
 * would cut into the reserve (D132) waits for a later tick.
 */
function blocked(calls: number, b: Batch, reserve: number): boolean {
  if (calls >= SHIELD_CALLS_MAX) b.stop = "cap";
  return b.stop !== null || (b.remaining !== null && b.remaining - 1 < reserve);
}

/** Reads the morning queue's due members until the cap, the reserve, a stop, or the deadline. */
async function readMorning(
  deps: SquadsDeps,
  db: Db,
  run: MorningRun & { calls: number; remaining: number | null; until: number },
): Promise<Batch> {
  const { target, signal } = run;
  const q = { day: run.day, unionId: run.unionId };
  // D152: the KvK opponent's calls still due, on its quota day only.
  const reserve = target.key
    ? SQUADS_SAFETY_MARGIN
    : squadsReserve(
        deps.now(),
        deps.env,
        TRACKED_COUNT,
        await opponentReserve(db, deps.now(), deps.env),
      );
  const b: Batch = {
    calls: 0,
    read: 0,
    withSquads: 0,
    failed: 0,
    might: 0,
    joined: 0,
    remaining: run.remaining,
    stop: null,
  };
  for (;;) {
    const due = await dueShield(db, q, deps.now(), SQUADS_BATCH_CALLS);
    if (due.length === 0) return b;
    for (const member of due) {
      // Never a call at or after `until`: 12:00 ST, when KvK starts, or the tick's budget.
      const late = deps.now().getTime() >= run.until;
      if (blocked(run.calls + b.calls, b, reserve) || signal.aborted || late) return b;
      const save = (m: Parameters<typeof saveShieldCall>[3]) =>
        saveShieldCall(
          db,
          { ...q, claimedAt: run.claimedAt },
          { morningCalls: run.calls + b.calls, morningQuotaRemaining: b.remaining },
          m,
        );
      // A far `rosterAt`: the morning read queues no newcomer into the squads queue.
      const call = {
        ...member,
        target,
        signal,
        day: run.day,
        rosterAt: new Date(8.64e15),
        queued: new Set<number>(),
      };
      const outcome = await readOne(deps, db, call, b, save);
      if (outcome !== "done" || b.stop) return b;
      await sleep(deps.paceMs ?? PACE_MS, signal);
    }
  }
}

/** Which read runs now for each shield-check alliance, by its own night and morning times (issue 859). */
export function passesAt(now: Date, deps: SquadsDeps, targets: ShieldTarget[]) {
  return targets.flatMap((target) => {
    const pass = shieldPassAt(now, deps.env, timesOf(target.settings));
    return pass ? [{ target, ...pass }] : [];
  });
}
