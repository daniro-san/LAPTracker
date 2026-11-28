// The raid opponent's reads (issue 861, D165): on the tick of each workspace's Start time (Saturday, 00:00 ST
// by default) and End time (Sunday, 00:00 ST by default), one read of the opponent alliance and one of our
// own, for each workspace whose `shield_check` is on (Raid prep's switch, D126, D134) and that set an
// opponent for that raid. Each on the alliance's own key (D124): `squadTargets`' rule, so the own alliance
// reads on LAP_API_KEY only while it has no saved key, and any other workspace only on its own key. The
// reserve is the after-reset check's (`startRead`): the morning check's calls stay. Our own side is the
// daily read's roster when the daily read fell in the same tick (no call).
//
// One attempt per read, on its tick only (`raidReadDue`): a tick that never came, or a read refused or
// failed, leaves that read missing, never a number from another time. Each row is claimed before its call
// (INVARIANT raid.one-call-per-row), so two overlapping ticks never send one read twice. The tick runs this
// first in its `after`, before the Raid Shield reads. One `raid.read` run-log line per workspace read,
// counts and a reason only (D71).
import { FRESH_MAX_AGE_MS } from "./collector-rows";
import { isFresh } from "./compute";
import type { Db } from "./db";
import { createRunLogger } from "./logger";
import {
  raidPhaseAt,
  raidMinute,
  raidReadDue,
  raidReadsAt,
  raidTimesOf,
  type RaidPhase,
  type RaidSideName,
} from "./raid-opponent";
import { getDailyRead } from "./repo/daily-reads";
import {
  claimRead,
  opponentsOn,
  rosterStoredIn,
  saveRead,
  type RaidOpponentRow,
} from "./repo/raid-opponents";
import { insertRunLog } from "./repo/run-logs";
import { allShieldSettings } from "./repo/shield-checks";
import { markKey } from "./repo/workspace-keys";
import { quotaDayRead } from "./schedule";
import { TICK_MIN } from "./shield-check";
import { startRead } from "./shield-reset";
import {
  NotFoundError,
  QuotaExhaustedError,
  type AllianceSnapshotInput,
  type V1Source,
} from "./sources/types";
import type { StartDaily } from "./squads-call";
import type { SquadsDeps } from "./squads-read";
import { keyStatusOf, squadTargets, type SquadTarget } from "./workspace-keys";

/** The tick's deps, with the alliance read too. */
export type RaidDeps = SquadsDeps & { v1: Pick<V1Source, "fetchAlliance"> };

/** A workspace whose raid read of `phase` may run on this day: its alliance, key, opponent and time. */
export interface RaidTarget {
  target: SquadTarget & { workspaceId: number };
  opponent: RaidOpponentRow;
  phase: RaidPhase;
  saturday: string;
  /** The read's time this week, minutes after 00:00 ST of its day (`raidMinute`). */
  minute: number;
  at: Date;
}

/**
 * The workspaces whose raid read of today's phase (Saturday: Start, Sunday: End) may run: the Raid prep
 * switch on, a key that reads under D124's rule, and an opponent set for that raid. None on other days. The
 * tick's gate (lib/tick-gate.ts) keeps which minutes these are.
 */
export async function raidTargets(db: Db, deps: Pick<SquadsDeps, "env">, now: Date) {
  const day = raidPhaseAt(now, deps.env);
  if (!day) return [];
  const [targets, settings, opponents] = await Promise.all([
    squadTargets(db, deps.env.WORKSPACE_KEYS_SECRET, now, "shield_check"),
    allShieldSettings(db),
    opponentsOn(db, day.saturday),
  ]);
  return targets.flatMap((target): RaidTarget[] => {
    const { workspaceId } = target;
    const opponent = workspaceId === null ? undefined : opponents.get(workspaceId);
    if (workspaceId === null || !opponent) return [];
    const times = raidTimesOf(settings.get(workspaceId) ?? null);
    // The time this week, after any event's window (D160); none clear: no read this week.
    const at = raidReadsAt(day.saturday, deps.env, times)[day.phase];
    const minute = raidMinute(day.saturday, deps.env, day.phase, times[day.phase]);
    if (!at || minute === null) return [];
    return [{ target: { ...target, workspaceId }, opponent, ...day, minute, at }];
  });
}

/** The raid reads due on this tick, one workspace after another, until `deadline` (epoch ms). */
export async function raidRead(deps: RaidDeps, db: Db, deadline: number): Promise<void> {
  const now = deps.now();
  // The clock first: outside Saturday's and Sunday's first hours no workspace is read.
  if (!raidPhaseAt(now, deps.env)) return;
  const due = (await raidTargets(db, deps, now)).filter((t) =>
    raidReadDue(now, deps.env, t.minute),
  );
  for (const t of due) {
    if (deps.now().getTime() >= deadline) return;
    await readTarget(deps, db, t, deadline);
  }
}

type Side = { side: RaidSideName; unionId: number };
const keyOf = (t: RaidTarget, side: RaidSideName) => ({
  workspaceId: t.target.workspaceId,
  saturday: t.saturday,
  phase: t.phase,
  side,
});

/** The answer as the row keeps it: totals and arrays only, no name, no photo, no raw body. */
const dataOf = (a: AllianceSnapshotInput, readAt: Date) => ({
  unionId: a.unionId,
  memberCount: a.memberCount,
  totalPower: a.totalPower,
  totalKills: a.totalKills,
  memberUids: a.members.map((m) => m.uid),
  memberPower: a.members.map((m) => m.power),
  memberKills: a.members.map((m) => m.kills),
  sourceUpdatedAt: a.sourceUpdatedAt,
  isFresh: isFresh(readAt, a.sourceUpdatedAt, FRESH_MAX_AGE_MS),
  error: null,
  readAt,
});

/** One workspace's reads and its log line. */
async function readTarget(deps: RaidDeps, db: Db, t: RaidTarget, deadline: number) {
  const log = createRunLogger(
    { insertRunLog: (line) => insertRunLog(db, line) },
    {
      readDay: quotaDayRead(deps.now(), deps.env),
      secrets: [...(deps.secrets ?? []), ...(t.target.key ? [t.target.key.apiKey] : [])],
      now: deps.now,
    },
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - deps.now().getTime()));
  try {
    const done = await readSides(deps, db, t, controller.signal);
    if (!done) return;
    const data = { union_id: t.target.unionId, phase: t.phase, ...done.counts };
    await log[done.reason ? "warn" : "info"]("raid.read", {
      ...data,
      ...(done.reason && { reason: done.reason }),
    });
  } finally {
    clearTimeout(timer);
    await log.shutdown();
  }
}

/**
 * The opponent's read and ours: each row claimed first, ours from the daily read when it fell in this tick,
 * then the quota check over the calls left, then one call each. Null when both rows were claimed before.
 */
async function readSides(deps: RaidDeps, db: Db, t: RaidTarget, signal: AbortSignal) {
  const now = deps.now();
  const sides: Side[] = [];
  // INVARIANT raid.one-call-per-row: the rows before the calls.
  for (const side of [
    { side: "them", unionId: t.opponent.unionId },
    { side: "us", unionId: t.target.unionId },
  ] as const) {
    if (await claimRead(db, keyOf(t, side.side), side.unionId, now)) sides.push(side);
  }
  if (sides.length === 0) return null;
  const counts = { calls: 0, read: 0, failed: 0, reused: 0 };
  const day = quotaDayRead(now, deps.env);
  const reused = sides.some((s) => s.side === "us") && (await reuseDaily(db, t, day, now));
  if (reused) counts.reused++;
  const calls = sides.filter((s) => s.side === "them" || !reused);
  if (calls.length === 0) return { counts, reason: null };
  const reason = await quotaRefusal(deps, db, t, { day, calls: calls.length, signal, counts });
  if (reason) {
    for (const s of calls) await saveRead(db, keyOf(t, s.side), { error: reason });
    counts.failed += calls.length;
    return { counts, reason };
  }
  return callAll(deps, db, { t, calls, signal, counts });
}

/** Our side from the daily read when it stored our roster in this tick: true when it did (no call). */
async function reuseDaily(db: Db, t: RaidTarget, day: string, now: Date): Promise<boolean> {
  const tick = { from: t.at, to: new Date(t.at.getTime() + TICK_MIN * 60_000) };
  const daily = await rosterStoredIn(db, { day, unionId: t.target.unionId, ...tick });
  if (!daily) return false;
  const { storedAt, ...row } = daily;
  await saveRead(db, keyOf(t, "us"), {
    ...row,
    error: null,
    isFresh: true,
    readAt: storedAt ?? now,
  });
  return true;
}

/** One call per read, in turn; a 429 stops the next one too, and that read is missing. */
async function callAll(
  deps: RaidDeps,
  db: Db,
  run: {
    t: RaidTarget;
    calls: Side[];
    signal: AbortSignal;
    counts: { calls: number; read: number; failed: number; reused: number };
  },
) {
  const { t, calls, signal, counts } = run;
  for (const [i, s] of calls.entries()) {
    const stop = await callOne(deps, db, t, s, signal);
    counts.calls++;
    if (stop === null) {
      counts.read++;
      continue;
    }
    counts.failed++;
    if (stop !== "quota_429") continue;
    for (const left of calls.slice(i + 1)) await saveRead(db, keyOf(t, left.side), { error: stop });
    counts.failed += calls.length - i - 1;
    return { counts, reason: stop };
  }
  return { counts, reason: null };
}

/**
 * Why the calls may not be made, or null: the after-reset check's start (`startRead`: our key from what the
 * day's reads left, a workspace key from one /quota call on it) and its reserve, the morning check's calls
 * included (INVARIANT budget.reserve-for-after).
 */
async function quotaRefusal(
  deps: RaidDeps,
  db: Db,
  t: RaidTarget,
  run: { day: string; calls: number; signal: AbortSignal; counts: { calls: number } },
): Promise<string | null> {
  const daily = await getDailyRead(db, run.day);
  if (!daily) return "no_daily_read";
  const start = await startRead(deps, db, {
    day: run.day,
    target: t.target,
    signal: run.signal,
    daily: daily as StartDaily,
  });
  run.counts.calls += start.quotaCalls;
  if (start.reason) return start.reason;
  if (start.remaining === null) return "quota_unknown";
  return start.remaining - run.calls < start.reserve ? "quota_low" : null;
}

/** One read, sent once with no retry; null when stored, else its error code. */
async function callOne(
  deps: RaidDeps,
  db: Db,
  t: RaidTarget,
  s: Side,
  signal: AbortSignal,
): Promise<string | null> {
  const { key } = t.target;
  try {
    // INVARIANT keys.own-quota-only: `key` null is LAP_API_KEY, for the own alliance only (squadTargets).
    const a = await deps.v1.fetchAlliance(s.unionId, undefined, signal, {
      ...(key && { apiKey: key.apiKey }),
      maxRetries: 0,
    });
    await saveRead(db, keyOf(t, s.side), dataOf(a, deps.now()));
    if (key && a.quota) {
      await markKey(
        db,
        key.workspaceId,
        key.nonce,
        { quotaRemaining: a.quota.remaining },
        deps.now(),
      );
    }
    return null;
  } catch (e) {
    const status = key ? keyStatusOf(e) : null;
    if (key && status) {
      const patch = { status, ...(status === "out_of_quota" && { quotaRemaining: 0 }) };
      await markKey(db, key.workspaceId, key.nonce, patch, deps.now());
    }
    const code =
      e instanceof QuotaExhaustedError
        ? "quota_429"
        : e instanceof NotFoundError
          ? "not_found"
          : "unavailable";
    await saveRead(db, keyOf(t, s.side), { error: code });
    return code;
  }
}
