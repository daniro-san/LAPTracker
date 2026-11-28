// The raid opponent's rules (issue 861, D165), pure: no IO, `now` passed in. Officers set one alliance of any
// server as this week's raid opponent in Raid prep; the raid is the whole Saturday, from the Friday→Saturday
// reset to the next one. So the Start read is on the tick right after the first reset (Saturday 00:00 ST)
// and the End read on the tick right after the next (Sunday 00:00 ST): each read takes a minute or two, so
// at most those minutes of Sunday are in it. Officers move either read in 15-minute ticks up to 02:00 ST;
// neither may meet a Raid Shield read's window (D137), and a read whose tick meets an event's window (D160)
// runs on the first tick after it that week (Origin of Chaos: the Start at 01:30 ST). A tick that never came
// leaves its read missing: no catch-up, and no Start→End for that side (INVARIANT freshness.no-stale-delta).
import { addDays, hhmm } from "./calendar-time";
import { memberChange, type MemberChange } from "./kvk";
import {
  eventsAround,
  quotaDayRead,
  serverDay,
  serverInstant,
  serverMinuteOfDay,
  serverWeekday,
  type ScheduleConfig,
} from "./schedule";
import { fridayOf, readSpans, TICK_MIN, type ShieldTimes, type Span } from "./shield-check";

type Zone = Pick<ScheduleConfig, "SERVER_TZ">;

/** The latest time either read may have: 02:00 ST, minutes after its day's 00:00 ST. */
export const RAID_LATEST = 120;
const TICK_MS = TICK_MIN * 60_000;

/** Every time either read may have, events aside: 00:00 to 02:00 ST, every 15 minutes. */
export const RAID_RANGE: readonly number[] = Array.from(
  { length: RAID_LATEST / TICK_MIN + 1 },
  (_, i) => i * TICK_MIN,
);

/** An alliance's raid read times: minutes after 00:00 ST of Saturday (`start`) and of Sunday (`end`). */
export interface RaidTimes {
  start: number;
  end: number;
}

/** No setting saved: both reads on the tick right after the reset. */
export const DEFAULT_RAID_TIMES: RaidTimes = { start: 0, end: 0 };

export const raidTimesOf = (
  row: { raidStartMinute: number; raidEndMinute: number } | null,
): RaidTimes => (row ? { start: row.raidStartMinute, end: row.raidEndMinute } : DEFAULT_RAID_TIMES);

export type RaidPhase = "start" | "end";
export type RaidSideName = "us" | "them";

const SUNDAY = 0;
const SATURDAY = 6;

const tickOf = (from: Date): Span => ({ from, to: new Date(from.getTime() + TICK_MS) });
const overlap = (a: Span, b: Span) => a.from < b.to && b.from < a.to;

/**
 * The scheduled events' windows around the raid of `saturday` (D160), each from its Before until its After's
 * due window closes: the tick's own rule (`tickClockDue`), so no raid read shares a tick with an event's run.
 */
function eventWindows(saturday: string, cfg: ScheduleConfig): Span[] {
  const w = cfg.SNAPSHOT_WINDOW_MIN * 60_000;
  return eventsAround(serverInstant(saturday, "00:00", cfg), cfg).flatMap((e) =>
    e.windows.map((x) => ({ from: x.beforeAt, to: new Date(x.afterAt.getTime() + w) })),
  );
}

/**
 * The minute a read runs in the raid of `saturday`: its time, or, in a week where that tick meets an event's
 * window, the first tick after the window (Origin of Chaos, 00:00–01:30 ST on its Saturday: the Start at
 * 01:30 ST). Null when no tick is clear by 02:00 ST: that week's read is not made. `events`: that week's
 * windows, when the caller already has them (`raidTimeChoices` reads each week's once).
 */
export function raidMinute(
  saturday: string,
  cfg: ScheduleConfig,
  phase: RaidPhase,
  minute: number,
  events: readonly Span[] = eventWindows(saturday, cfg),
): number | null {
  const day = phase === "start" ? saturday : addDays(saturday, 1);
  for (let m = minute; m <= RAID_LATEST; m += TICK_MIN) {
    const tick = tickOf(serverInstant(day, hhmm(m), cfg));
    if (!events.some((e) => overlap(tick, e))) return m;
  }
  return null;
}

/** The raid of Saturday `saturday` (server date): when its Start and End reads run, or null (`raidMinute`). */
export function raidReadsAt(saturday: string, cfg: ScheduleConfig, times: RaidTimes) {
  const events = eventWindows(saturday, cfg);
  const at = (phase: RaidPhase, day: string) => {
    const m = raidMinute(saturday, cfg, phase, times[phase], events);
    return m === null ? null : serverInstant(day, hhmm(m), cfg);
  };
  return { start: at("start", saturday), end: at("end", addDays(saturday, 1)) };
}

/**
 * Which raid read's day `now` is in, while one may still be due: Saturday 00:00–02:15 ST is the Start of
 * that Saturday's raid, Sunday 00:00–02:15 ST the End of the day before's. Null at any other time.
 */
export function raidPhaseAt(now: Date, cfg: Zone): { phase: RaidPhase; saturday: string } | null {
  if (serverMinuteOfDay(now, cfg) >= RAID_LATEST + TICK_MIN) return null;
  const weekday = serverWeekday(now, cfg);
  const today = serverDay(now, cfg);
  if (weekday === SATURDAY) return { phase: "start", saturday: today };
  if (weekday === SUNDAY) return { phase: "end", saturday: addDays(today, -1) };
  return null;
}

/** Whether a read at `minute` is due now: on its own tick, the 15 minutes from it, and only then. */
export function raidReadDue(now: Date, cfg: Zone, minute: number): boolean {
  const at = serverMinuteOfDay(now, cfg);
  return at >= minute && at < minute + TICK_MIN;
}

/** The raid reads' ticks in the week of Friday `day`, the reads that week makes. */
export function raidSpans(day: string, cfg: ScheduleConfig, times: RaidTimes): Span[] {
  const at = raidReadsAt(addDays(day, 1), cfg, times);
  return [at.start, at.end].flatMap((t) => (t ? [tickOf(t)] : []));
}

/** Weeks the checks look ahead: the game's 4-week cycle, one Origin of Chaos in it (D160). */
const CYCLE_WEEKS = 4;
const weeksFrom = (now: Date, cfg: ScheduleConfig) => {
  const first = fridayOf(quotaDayRead(now, cfg));
  return Array.from({ length: CYCLE_WEEKS }, (_, w) => addDays(first, 7 * w));
};

/**
 * Why officers may not choose `raid`, or null, over the next four weeks: `event_window` when a read has no
 * tick clear of the events by 02:00 ST (D160), `reads_overlap` when a read's tick meets a Raid Shield read's
 * window at the alliance's own times (`shield`, D137).
 */
export function raidTimesRefusal(
  raid: RaidTimes,
  shield: ShieldTimes,
  cfg: ScheduleConfig,
  now: Date,
): "event_window" | "reads_overlap" | null {
  for (const day of weeksFrom(now, cfg)) {
    const at = raidReadsAt(addDays(day, 1), cfg, raid);
    if (!at.start || !at.end) return "event_window";
    const reads = readSpans(day, cfg, shield);
    if ([at.start, at.end].some((t) => reads.some((r) => overlap(tickOf(t), r))))
      return "reads_overlap";
  }
  return null;
}

/** The times each read may be given now: those of RAID_RANGE with a tick clear of the events every week. */
export function raidTimeChoices(
  cfg: ScheduleConfig,
  now: Date,
): { start: number[]; end: number[] } {
  // Each week's event windows once, for every time of both reads.
  const weeks = weeksFrom(now, cfg).map((day) => {
    const saturday = addDays(day, 1);
    return { saturday, events: eventWindows(saturday, cfg) };
  });
  const free = (phase: RaidPhase) =>
    RAID_RANGE.filter((m) =>
      weeks.every((w) => raidMinute(w.saturday, cfg, phase, m, w.events) !== null),
    );
  return { start: free("start"), end: free("end") };
}

/** One stored raid read (`raid_reads`), as the result reads it. */
export interface RaidReadFacts {
  phase: RaidPhase;
  side: RaidSideName;
  unionId: number;
  error: string | null;
  isFresh: boolean;
  memberCount: number | null;
  memberUids: number[] | null;
  memberPower: (number | null)[] | null;
  memberKills: (number | null)[] | null;
  readAt: Date;
}

/** One side of a raid: its members at each read, and Start→End over the members in both. */
export interface RaidSide {
  start: { members: number | null; at: number } | null;
  end: { members: number | null; at: number } | null;
  /** Null unless both reads are usable: a missing, failed or stale read gives no change. */
  change: MemberChange | null;
}

/**
 * One side of the raid from its stored reads: only a read of `unionId` with an answer that is fresh counts
 * (a read claimed and never answered, refused, or stale counts as missing). Start→End is D152's rule over
 * the members in both reads (`memberChange`): one who left or joined is not counted, a fall in kills
 * counts as none.
 */
export function raidSide(
  reads: readonly RaidReadFacts[],
  side: RaidSideName,
  unionId: number,
): RaidSide {
  const usable = (phase: RaidPhase) =>
    reads.find(
      (r) =>
        r.phase === phase &&
        r.side === side &&
        r.unionId === unionId &&
        r.error === null &&
        r.isFresh &&
        r.memberUids !== null,
    ) ?? null;
  const [s, e] = [usable("start"), usable("end")];
  const point = (r: RaidReadFacts | null) =>
    r && { members: r.memberCount, at: r.readAt.getTime() };
  const members = (r: RaidReadFacts) => {
    const uids = r.memberUids ?? [];
    const none = uids.map(() => null);
    return { uids, might: r.memberPower ?? none, kills: r.memberKills ?? none };
  };
  // INVARIANT freshness.no-stale-delta: no change unless both reads are usable.
  return {
    start: point(s),
    end: point(e),
    change: s && e ? memberChange(members(s), members(e)) : null,
  };
}
