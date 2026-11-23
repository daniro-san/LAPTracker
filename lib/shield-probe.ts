// Issue 726: a one-off probe read, approved by the owner on 2026-11-22 with its quota cost (about 100
// calls, once). On the tick that falls in 02:30–02:45 ST on Mon 2026-11-23, every member of the own alliance
// (OGs, when its `shield_check` is on) is read once with the Raid Shield checks' call, on the same key. Its
// readings' map times (`player_reads.map_updated_at`) show when the tracker rescans the map after the reset.
// The readings land in `player_reads` at 02:30 Monday, outside both windows the checks, Raid prep, the
// member card, the summary and the push read (`passWindows`: Friday 23:00–00:00, Saturday 10:00–12:00 ST),
// so no check counts them. It writes no Raid prep mark, no shield_checks row, no might version, no post and
// no push. The `app_alerts` claim (id PROBE_ALERT) makes it run at most once.
// REMOVE: a follow-up PR deletes this file, its call in lib/squads-tick.ts and its test (issue 726).
import { OWN_ALLIANCE_ID, TRACKED_COUNT } from "../config/alliances";
import type { Db } from "./db";
import { opponentReserve } from "./kvk-reserve";
import { createRunLogger } from "./logger";
import { claimAlert } from "./repo/app-errors";
import { getDailyRead } from "./repo/daily-reads";
import { insertRunLog } from "./repo/run-logs";
import { dayRosterUids, getSquadRead } from "./repo/squads";
import { quotaDayRead, serverInstant } from "./schedule";
import { SHIELD_CALLS_MAX } from "./shield-check";
import { SQUADS_SAFETY_MARGIN, squadsReserve } from "./squads";
import { readOne, startQuota, type Batch, type StartDaily } from "./squads-call";
import { PACE_MS, type SquadsDeps } from "./squads-read";
import { squadTargets, type SquadTarget } from "./workspace-keys";

/** The probe's one window, in server time (issue 726, owner 2026-11-22). Removed by the follow-up PR. */
export const PROBE_WINDOW = { day: "2026-11-23", from: "02:30", to: "02:45" } as const;

/** The probe's claim row in `app_alerts` (1: retired, 2: the tick-silence alert). */
export const PROBE_ALERT = 3;

/** Whether `now` is inside the probe's window. */
export function probeDue(now: Date, cfg: Parameters<typeof serverInstant>[2]): boolean {
  const from = serverInstant(PROBE_WINDOW.day, PROBE_WINDOW.from, cfg);
  const to = serverInstant(PROBE_WINDOW.day, PROBE_WINDOW.to, cfg);
  return now >= from && now < to;
}

/**
 * The probe read: claimed once, then every member of the day's roster once, until the cap, the reserve, a
 * stop or `deadline` (epoch ms). One `shield.probe` run-log line with counts and a reason only.
 */
export async function shieldProbe(deps: SquadsDeps, db: Db, deadline: number): Promise<void> {
  const now = deps.now();
  if (!probeDue(now, deps.env)) return;
  // One statement, so two overlapping ticks never both win.
  if (!(await claimAlert(db, PROBE_ALERT, now, 7 * 86_400_000))) return;
  const day = quotaDayRead(now, deps.env);
  const targets = await squadTargets(db, deps.env.WORKSPACE_KEYS_SECRET, now, "shield_check");
  const target = targets.find((t) => t.unionId === OWN_ALLIANCE_ID) ?? null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - now.getTime()));
  const log = createRunLogger(
    { insertRunLog: (line) => insertRunLog(db, line) },
    {
      readDay: day,
      secrets: [...(deps.secrets ?? []), ...(target?.key ? [target.key.apiKey] : [])],
      now: deps.now,
    },
  );
  try {
    const run = { day, target, signal: controller.signal, deadline };
    const { members, calls, b } = await readProbe(deps, db, run);
    const data = {
      union_id: OWN_ALLIANCE_ID,
      members,
      calls,
      players: b.read,
      failed: b.failed,
      quota_remaining: b.remaining,
      ...(b.stop && { reason: b.stop }),
    };
    console.info("shield.probe", data);
    await log[b.stop ? "warn" : "info"]("shield.probe", data);
  } finally {
    clearTimeout(timer);
    await log.shutdown();
  }
}

type Run = { day: string; target: SquadTarget | null; signal: AbortSignal; deadline: number };
type Calls = Run & { target: SquadTarget; uids: number[]; reserve: number; quotaCalls: number };

/** The roster, the quota check, then the calls. `calls` counts a workspace key's /quota call too. */
async function readProbe(deps: SquadsDeps, db: Db, run: Run) {
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
  const { target } = run;
  const uids = target ? await dayRosterUids(db, run.day, target.unionId) : null;
  const daily = await getDailyRead(db, run.day);
  if (!target || !uids || !daily) {
    b.stop = target ? "no_roster" : "no_target";
    return { members: uids?.length ?? 0, calls: 0, b };
  }
  const start = await startProbe(deps, db, { ...run, target, daily: daily as StartDaily });
  b.remaining = start.remaining;
  b.stop = start.reason;
  // The quota check: the whole read must fit above the reserve, or nothing is read.
  if (!b.stop && (b.remaining as number) - uids.length < start.reserve) b.stop = "quota_low";
  if (!b.stop) await callAll(deps, db, { ...run, ...start, target, uids }, b);
  return { members: uids.length, calls: start.quotaCalls + b.calls, b };
}

/**
 * The quota the probe starts from and the reserve it keeps, as the morning check's start: our key, what
 * the day's squads read (or the daily read) left; a workspace key, one /quota call on it (D124).
 */
async function startProbe(
  deps: SquadsDeps,
  db: Db,
  run: Run & { target: SquadTarget; daily: StartDaily },
) {
  const { target } = run;
  const quota = await startQuota(deps, db, {
    daily: run.daily,
    key: target.key,
    signal: run.signal,
  });
  const squads = target.key ? null : await getSquadRead(db, run.day, target.unionId);
  const remaining = squads?.quotaRemaining ?? quota.remaining;
  const now = deps.now();
  const reserve = target.key
    ? SQUADS_SAFETY_MARGIN
    : squadsReserve(now, deps.env, TRACKED_COUNT, await opponentReserve(db, now, deps.env));
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
  // No might version from the probe: `workspaceId` null skips it (the key stays the target's).
  const target = { ...run.target, workspaceId: null };
  for (const uid of run.uids) {
    b.stop = blockedBy(deps, run, b);
    if (b.stop) return;
    // A far `rosterAt`: the probe queues no newcomer; it has no queue row, so `save` only goes on.
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
