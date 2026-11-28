// The Raid Shield check's after-reset check (issue 827, D137 2026-11-28b): every Saturday, on the two ticks
// from the alliance's after-reset time (02:30 and 02:45 ST by default; officers move it or turn it off,
// issue 859), every member of each alliance whose `shield_check` is on (D134) is read once with the
// checks' call (`readOne`, no `fresh`) on the alliance's own key (D124), from the day's roster. At that hour
// most maps are from after the 00:00 ST reset (issue 726: 64 % and 56 % in the two probes), so its readings
// tell Raid prep's "To check by hand" which members a map near the reset vouches for; officers still
// confirm. They land in `player_reads` at 02:30–03:03 ST, in `resetWindow` and outside both `passWindows`,
// so the night and morning counts, the summary, the pushes and the fill never count them. It writes no Raid
// prep mark, no shield_checks row, no might version, no post and no push. It keeps the morning check's
// calls in reserve and makes no call for an alliance whose squads read is still running.
//
// Resumable: a tick reads only the members with no reading in this Saturday's `resetWindow`, so the 02:45
// tick goes on where the 02:30 tick's budget ended, or retries an alliance skipped at 02:30, and no member
// is read twice in a week. An alliance with nobody left is skipped with no log line. The `app_alerts` claim
// (RESET_ALERT) lets only one of two overlapping ticks run.
import { TRACKED_COUNT } from "../config/alliances";
import type { Db } from "./db";
import { opponentReserve } from "./kvk-reserve";
import { createRunLogger } from "./logger";
import { claimAlert } from "./repo/app-errors";
import { getDailyRead } from "./repo/daily-reads";
import { insertRunLog } from "./repo/run-logs";
import { allShieldSettings, shieldReadings } from "./repo/shield-checks";
import { dayRosterUids, getSquadRead } from "./repo/squads";
import { quotaDayRead } from "./schedule";
import {
  resetReadDue,
  resetSpanOpen,
  resetWindow,
  SHIELD_CALLS_MAX,
  timesOf,
} from "./shield-check";
import { SQUADS_SAFETY_MARGIN, squadsReserve } from "./squads";
import { readOne, startQuota, type Batch, type StartDaily } from "./squads-call";
import { PACE_MS, type SquadsDeps } from "./squads-read";
import { squadTargets, type SquadTarget } from "./workspace-keys";

/**
 * The after-reset check's claim row in `app_alerts` (1: retired, 2: the tick-silence alert, 3 and 4: issue
 * 726's probe reads, 5: issue 789's API probe). Claimed per tick: its gap is under the 15 minutes between
 * the 02:30 and 02:45 ticks, so a second tick overlapping the first is refused and the next one runs.
 */
export const RESET_ALERT = 6;
const RESET_GAP_MS = 10 * 60_000;

/**
 * Each shield-check alliance whose after-reset check is on, with its time (issue 859): the targets the
 * check reads (a turned-off or deleted workspace is none) and their saved times, 02:30 ST by default. The
 * tick's gate (lib/tick-gate.ts) keeps which minutes these are.
 */
export async function resetTargets(db: Db, secret: string | undefined, now: Date) {
  const [targets, settings] = await Promise.all([
    squadTargets(db, secret, now, "shield_check"),
    allShieldSettings(db),
  ]);
  return targets.flatMap((target) => {
    const row = target.workspaceId === null ? null : (settings.get(target.workspaceId) ?? null);
    const minute = timesOf(row).reset;
    return minute === null ? [] : [{ target, minute }];
  });
}

/**
 * The after-reset check on this tick: claimed, then each shield-check alliance's members not read yet this
 * Saturday, until the cap, the reserve, a stop or `deadline` (epoch ms). An alliance not started before
 * `deadline` waits for the next tick. One `shield.reset` run-log line per alliance read or stopped, counts
 * and a reason only (D71).
 */
export async function shieldReset(deps: SquadsDeps, db: Db, deadline: number): Promise<void> {
  const now = deps.now();
  // The clock first: outside Saturday 00:15–10:45 ST no alliance's check can be due.
  if (!resetSpanOpen(now, deps.env)) return;
  const due = (await resetTargets(db, deps.env.WORKSPACE_KEYS_SECRET, now)).filter((t) =>
    resetReadDue(now, deps.env, t.minute),
  );
  if (due.length === 0) return;
  // One statement, so two overlapping ticks never both win.
  if (!(await claimAlert(db, RESET_ALERT, now, RESET_GAP_MS))) return;
  const day = quotaDayRead(now, deps.env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - now.getTime()));
  try {
    for (const { target, minute } of due) {
      if (controller.signal.aborted || deps.now().getTime() >= deadline) return;
      await readTarget(deps, db, { day, target, minute, signal: controller.signal, deadline });
    }
  } finally {
    clearTimeout(timer);
  }
}

type Run = {
  day: string;
  target: SquadTarget;
  /** The alliance's after-reset time: its readings' window starts there. */
  minute: number;
  signal: AbortSignal;
  deadline: number;
};
type Calls = Run & { uids: number[]; reserve: number; quotaCalls: number };

/** One alliance's read and its log line. */
async function readTarget(deps: SquadsDeps, db: Db, run: Run) {
  const log = createRunLogger(
    { insertRunLog: (line) => insertRunLog(db, line) },
    {
      readDay: run.day,
      secrets: [...(deps.secrets ?? []), ...(run.target.key ? [run.target.key.apiKey] : [])],
      now: deps.now,
    },
  );
  try {
    const read = await readAlliance(deps, db, run);
    if (!read) return;
    const { members, calls, b } = read;
    const data = {
      union_id: run.target.unionId,
      members,
      calls,
      players: b.read,
      failed: b.failed,
      quota_remaining: b.remaining,
      ...(b.stop && { reason: b.stop }),
    };
    await log[b.stop ? "warn" : "info"]("shield.reset", data);
  } finally {
    await log.shutdown();
  }
}

/**
 * The members still to read, the quota check, then the calls; null when everyone on the roster has a
 * reading in this Saturday's window. `members` is those still to read; `calls` counts a workspace key's
 * /quota call too.
 */
async function readAlliance(deps: SquadsDeps, db: Db, run: Run) {
  const b: Batch = {
    calls: 0,
    read: 0,
    withSquads: 0,
    failed: 0,
    might: 0,
    joined: 0,
    remaining: null,
    stop: null,
  };
  const roster = await dayRosterUids(db, run.day, run.target.unionId);
  const daily = await getDailyRead(db, run.day);
  if (!roster || !daily) {
    b.stop = "no_roster";
    return { members: roster?.length ?? 0, calls: 0, b };
  }
  const w = resetWindow(run.day, deps.env, run.minute);
  const done = new Set(
    (await shieldReadings(db, run.target.unionId, w.from, w.to)).map((r) => r.uid),
  );
  const uids = roster.filter((uid) => !done.has(uid));
  if (uids.length === 0) return null;
  const start = await startRead(deps, db, { ...run, daily: daily as StartDaily });
  b.remaining = start.remaining;
  b.stop = start.reason;
  // The quota check: the whole read must fit above the reserve, or nothing is read.
  if (!b.stop && (b.remaining as number) - uids.length < start.reserve) b.stop = "quota_low";
  if (!b.stop) await callAll(deps, db, { ...run, ...start, uids }, b);
  return { members: uids.length, calls: start.quotaCalls + b.calls, b };
}

/**
 * The quota the read starts from and the reserve it keeps, as the morning check's start: our key, what
 * the day's squads read (or the daily read) left; a workspace key, one /quota call on it (D124). The
 * reserve is the morning check's own plus its most calls (`SHIELD_CALLS_MAX`): both spend from Saturday's
 * UTC quota day. While the alliance's squads read is still running, `squads_busy` and no call at all. The
 * raid opponent's reads (lib/raid-read.ts, issue 861) start the same way.
 */
export async function startRead(
  deps: SquadsDeps,
  db: Db,
  run: Pick<Run, "day" | "target" | "signal"> & { daily: StartDaily },
) {
  const { target } = run;
  const squads = await getSquadRead(db, run.day, target.unionId);
  if (squads?.status === "running")
    return { remaining: null, reserve: 0, reason: "squads_busy", quotaCalls: 0 };
  const quota = await startQuota(deps, db, {
    daily: run.daily,
    key: target.key,
    signal: run.signal,
  });
  const remaining = (target.key ? null : squads?.quotaRemaining) ?? quota.remaining;
  const now = deps.now();
  const morning = target.key
    ? SQUADS_SAFETY_MARGIN
    : squadsReserve(now, deps.env, TRACKED_COUNT, await opponentReserve(db, now, deps.env));
  const reserve = morning + SHIELD_CALLS_MAX;
  const reason = quota.reason ?? (remaining === null ? "quota_unknown" : null);
  return { remaining, reserve, reason, quotaCalls: quota.calls };
}

/** Why the next call may not be made, or null: the cap, the reserve, the deadline. */
function blockedBy(deps: SquadsDeps, run: Calls, b: Batch): string | null {
  if (run.quotaCalls + b.calls >= SHIELD_CALLS_MAX) return "cap";
  if (b.remaining !== null && b.remaining - 1 < run.reserve) return "reserve";
  if (run.signal.aborted || deps.now().getTime() >= run.deadline) return "deadline";
  return null;
}

/** One call per member, sequential and paced, with the checks' call (`readOne`). */
async function callAll(deps: SquadsDeps, db: Db, run: Calls, b: Batch) {
  // No might version from this read: `workspaceId` null skips it (the key stays the target's).
  const target = { ...run.target, workspaceId: null };
  for (const uid of run.uids) {
    b.stop = blockedBy(deps, run, b);
    if (b.stop) return;
    // A far `rosterAt`: this read queues no newcomer; it has no queue row, so `save` only goes on.
    const call = {
      uid,
      attempts: 0,
      target,
      signal: run.signal,
      day: run.day,
      rosterAt: new Date(8.64e15),
      queued: new Set<number>(),
    };
    const outcome = await readOne(deps, db, call, b, async () => true);
    if (outcome !== "done" || b.stop) return;
    await new Promise((resolve) => setTimeout(resolve, deps.paceMs ?? PACE_MS));
  }
}
