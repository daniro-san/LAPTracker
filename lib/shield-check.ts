// The Raid Shield check's rules (issue 474, D137), pure: no IO, `now` passed in. When its reads run and
// what one tracker reading of a member says. It never says how long a seen shield lasts: `shield_type` 0
// was seen for an 8 h and a 24 h shield (owner, 2026-11-21).
//
// The raid starts at the server reset (00:00 ST) on the night before KvK, and KvK starts at 12:00 ST on
// Saturday; nobody keeps a shield after that (owner, 2026-11-20). So: one read of the whole alliance on
// Friday night that must end before 00:00 ST, one on Saturday after the reset (issue 827), and one on
// Saturday morning that must end before 12:00 ST. Nothing runs after 12:00 ST. Each alliance's officers
// choose the three times in Alliance settings (issue 859); the defaults are 23:30, 02:30 and 10:00 ST.
//
// The shield comes from the tracker's map scan (`map_updated_at`), not from the read itself: `fresh` does
// not refresh it (owner's test, 2026-11-20). A shield turned on after the last scan is "not seen yet", a
// hint and never a ✗ (D75).
import { addDays, hhmm, mondayOf } from "./calendar-time";
import {
  eventsAround,
  quotaDayRead,
  serverInstant,
  serverMinuteOfDay,
  serverWeekday,
  type ScheduleConfig,
} from "./schedule";

type Cfg = Pick<ScheduleConfig, "SERVER_TZ" | "DAILY_ROSTER_AT">;
type Zone = Pick<ScheduleConfig, "SERVER_TZ">;

/** The reads start on the ticks, every 15 minutes: a chosen time moves to the next tick. */
export const TICK_MIN = 15;
/** Friday's read starts at the 23:30 ST tick by default, right after the daily roster read (D72). */
export const NIGHT_MINUTE = 23 * 60 + 30;
/** The night read's latest start: the last tick before the 00:00 ST reset. */
export const NIGHT_LATEST = 23 * 60 + 45;
/** The morning read's earliest and latest start (owner: between 10:00 and 11:00 ST). */
export const MORNING_MIN = 10 * 60;
export const MORNING_MAX = 11 * 60;
/** KvK starts at 12:00 ST on Saturday: no shield read after it. */
export const KVK_MINUTE = 12 * 60;
/** The most calls one morning read makes, retries included: the squads read's cap (D132). */
export const SHIELD_CALLS_MAX = 120;
/** The night window opens this long before the night read's start (23:00 ST for 23:30). */
const NIGHT_LEAD_MIN = 30;

/**
 * The after-reset check (issue 827, D137 2026-11-28b): one read of every member on the two ticks from its
 * time (02:30 and 02:45 by default, 02:45 for what 02:30 left), when most maps are from after the reset
 * (the probes of issue 726). Its answers land in the 45 minutes from its time: the last tick plus the
 * tick's 180 s budget ends well before.
 */
export const RESET_FROM = 2 * 60 + 30;
const RESET_DUE_MIN = 30;
const RESET_SPAN_MIN = 45;
/** The after-reset check's earliest and latest time: after the 00:00 ST tick, its window ending by 11:00. */
export const RESET_EARLIEST = 15;
export const RESET_LATEST = MORNING_MAX - RESET_SPAN_MIN;

/** Weeks the event check looks ahead: the game's 4-week cycle, one Origin of Chaos in it (D160). */
const CYCLE_WEEKS = 4;

const FRIDAY = 5;
const SATURDAY = 6;

/** An alliance's three read times, minutes after 00:00 ST; `reset` null: no after-reset check. */
export interface ShieldTimes {
  night: number;
  morning: number;
  reset: number | null;
}

/** The times with no setting saved: nothing changes until officers choose. */
export const DEFAULT_TIMES: ShieldTimes = {
  night: NIGHT_MINUTE,
  morning: MORNING_MIN,
  reset: RESET_FROM,
};

/** The tick a chosen minute snaps to: the first one at or after it. */
export const snapToTick = (minute: number) => Math.ceil(minute / TICK_MIN) * TICK_MIN;

const ticks = (from: number, to: number) =>
  Array.from({ length: Math.floor((to - from) / TICK_MIN) + 1 }, (_, i) => from + i * TICK_MIN);

const minuteOf = (time: string) => {
  const [h = 0, m = 0] = time.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Every start time each read may have, events aside: the night read from the day's roster read
 * (DAILY_ROSTER_AT, D72) to 23:45 ST, since it is that day's squads read (D132) and reads the queue the
 * roster read makes; the morning read 10:00–11:00 ST; the after-reset check 00:15–10:15 ST.
 */
export const timeRanges = (cfg: Pick<ScheduleConfig, "DAILY_ROSTER_AT">) => ({
  night: ticks(snapToTick(minuteOf(cfg.DAILY_ROSTER_AT)), NIGHT_LATEST),
  morning: ticks(MORNING_MIN, MORNING_MAX),
  reset: ticks(RESET_EARLIEST, RESET_LATEST),
});

/** The morning read's start time, kept inside 10:00–11:00 ST. */
export const morningMinuteOf = (minute: number | null | undefined) =>
  Math.min(MORNING_MAX, Math.max(MORNING_MIN, minute ?? MORNING_MIN));

/** An alliance's stored times (`shield_settings`), or the defaults when it saved none. */
export function timesOf(
  row: {
    nightMinute: number;
    morningMinute: number;
    resetRead: boolean;
    resetMinute: number;
  } | null,
): ShieldTimes {
  if (!row) return DEFAULT_TIMES;
  return {
    night: row.nightMinute,
    morning: morningMinuteOf(row.morningMinute),
    reset: row.resetRead ? row.resetMinute : null,
  };
}

export type ShieldPass = "night" | "morning";

/**
 * Which read may run at `now`, with its quota day (`day`, the daily read's date: Friday's) and the instant
 * it must end by: Friday from the night time until 00:00 ST, Saturday from the morning time until 12:00 ST.
 */
export function shieldPassAt(
  now: Date,
  cfg: Cfg,
  times: Pick<ShieldTimes, "night" | "morning">,
): { pass: ShieldPass; day: string; endsAt: Date } | null {
  const weekday = serverWeekday(now, cfg);
  const minute = serverMinuteOfDay(now, cfg);
  const day = quotaDayRead(now, cfg);
  const saturday = addDay(day);
  if (weekday === FRIDAY && minute >= times.night)
    return { pass: "night", day, endsAt: serverInstant(saturday, "00:00", cfg) };
  if (weekday === SATURDAY && minute >= times.morning && minute < KVK_MINUTE)
    return { pass: "morning", day, endsAt: kvkStart(day, cfg) };
  return null;
}

/**
 * Whether either read could run at `now` for any alliance (the earliest times an alliance may choose): the
 * tick looks at no workspace outside these windows.
 */
export function shieldWindowOpen(now: Date, cfg: Cfg) {
  const night = Math.min(NIGHT_MINUTE, ...timeRanges(cfg).night);
  return shieldPassAt(now, cfg, { night, morning: MORNING_MIN }) !== null;
}

const addDay = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** KvK's start after the check of Friday `day`: Saturday 12:00 ST. */
export const kvkStart = (day: string, cfg: Zone) => serverInstant(addDay(day), "12:00", cfg);

/** The Friday whose night the roll call of `day` prepares: that week's (Monday + 4). */
export const fridayOf = (day: string) => addDays(mondayOf(day), 4);

/**
 * The raid a Raid prep roll call of server day `day` prepares (D137): its week's Friday, the Saturday of the
 * reset that starts the raid (00:00 ST) and of KvK's start (12:00 ST). Raid prep's page, a member's own
 * page and the member card (issue 634: from `night`, the night check's start at the alliance's time, until
 * `kvk`) all count from it, so they never disagree on a roll call added on another day.
 */
export function raidOf(day: string, cfg: Zone, times: ShieldTimes = DEFAULT_TIMES) {
  const friday = fridayOf(day);
  const saturday = addDay(friday);
  return {
    friday,
    saturday,
    night: serverInstant(friday, hhmm(times.night), cfg),
    reset: serverInstant(saturday, "00:00", cfg),
    kvk: kvkStart(friday, cfg),
  };
}

/** Whether an after-reset check's tick is now: Saturday, on the two ticks from `minute` (02:30–03:00 ST). */
export function resetReadDue(now: Date, cfg: Zone, minute: number = RESET_FROM): boolean {
  const at = serverMinuteOfDay(now, cfg);
  return serverWeekday(now, cfg) === SATURDAY && at >= minute && at < minute + RESET_DUE_MIN;
}

/** Whether any alliance's after-reset check could be due now: Saturday 00:15–10:45 ST. */
export function resetSpanOpen(now: Date, cfg: Zone): boolean {
  const at = serverMinuteOfDay(now, cfg);
  return (
    serverWeekday(now, cfg) === SATURDAY &&
    at >= RESET_EARLIEST &&
    at < RESET_LATEST + RESET_DUE_MIN
  );
}

/**
 * Where the after-reset check's answers fall, for the check of Friday `day`: Saturday from its time for 45
 * minutes (02:30–03:15 ST by default). Apart from `passWindows`, so the night and morning counts, the
 * summary, the pushes and the fill never count it; Raid prep reads it.
 */
export function resetWindow(day: string, cfg: Zone, minute: number = RESET_FROM) {
  const saturday = addDay(day);
  return {
    from: serverInstant(saturday, hhmm(minute), cfg),
    to: serverInstant(saturday, hhmm(minute + RESET_SPAN_MIN), cfg),
  };
}

/** One stored tracker reading of a member (`player_reads`, D132). */
export interface ShieldReading {
  shielding: number | null;
  shieldType: number | null;
  /** When the tracker's map scan saw the member: the shield's real age. */
  mapAt: Date | null;
  readAt: Date;
}

/**
 * What the tracker's reading suggests: `on` (a shield seen), `not_seen` (the last map scan saw none: a
 * hint, never a ✗) or `unknown` (no reading, or the field missing): never counted (D75).
 */
export type ShieldSuggestion = "on" | "not_seen" | "unknown";

export function suggestionOf(r: ShieldReading | null): ShieldSuggestion {
  if (!r || r.shielding === null) return "unknown";
  return r.shielding === 1 ? "on" : "not_seen";
}

/**
 * Where each read's answers fall, for the check of Friday `day`: the night from 30 minutes before its time
 * to 00:00 ST, the morning from its time to 12:00 ST (KvK); 23:00 and 10:00 ST by default. A member's
 * newest reading inside a window is that read's.
 */
export function passWindows(
  day: string,
  cfg: Zone,
  times: Pick<ShieldTimes, "night" | "morning"> = DEFAULT_TIMES,
) {
  const saturday = addDay(day);
  return {
    night: {
      from: serverInstant(day, hhmm(times.night - NIGHT_LEAD_MIN), cfg),
      to: serverInstant(saturday, "00:00", cfg),
    },
    morning: { from: serverInstant(saturday, hhmm(times.morning), cfg), to: kvkStart(day, cfg) },
  };
}

export type Span = { from: Date; to: Date };
const overlap = (a: Span, b: Span) => a.from < b.to && b.from < a.to;

/**
 * The scheduled events' windows around the check of Friday `day` (D160), each from its Before or its
 * event's start, whichever is later, until its After's due window closes. The KvK's Before comes two hours
 * before KvK starts: the morning read runs in those hours by design (D137), so it counts from the start.
 */
function eventSpans(day: string, cfg: ScheduleConfig): Span[] {
  const w = cfg.SNAPSHOT_WINDOW_MIN * 60_000;
  return eventsAround(serverInstant(addDay(day), "00:00", cfg), cfg).flatMap((e) =>
    e.windows.map((x) => ({
      from: new Date(Math.max(x.beforeAt.getTime(), e.eventAtUtc.getTime())),
      to: new Date(x.afterAt.getTime() + w),
    })),
  );
}

/** Why reads with the windows `spansOf` gives may not run, over the cycle's next weeks, or null. */
function clash(
  spansOf: (day: string) => Span[],
  cfg: ScheduleConfig,
  now: Date,
): "event_window" | "reads_overlap" | null {
  const first = fridayOf(quotaDayRead(now, cfg));
  for (let week = 0; week < CYCLE_WEEKS; week++) {
    const day = addDays(first, 7 * week);
    const spans = spansOf(day);
    const events = eventSpans(day, cfg);
    if (spans.some((s) => events.some((e) => overlap(s, e)))) return "event_window";
    if (spans.some((s, i) => spans.slice(i + 1).some((o) => overlap(s, o)))) return "reads_overlap";
  }
  return null;
}

/** The read windows of `times` for the check of Friday `day`: night, after-reset (when on), morning. */
export const readSpans = (day: string, cfg: Zone, times: ShieldTimes): Span[] => {
  const w = passWindows(day, cfg, times);
  return [
    w.night,
    ...(times.reset === null ? [] : [resetWindow(day, cfg, times.reset)]),
    w.morning,
  ];
};

/**
 * Why officers may not choose `times`, or null: a read's window overlaps an event's window (D160) in one
 * of the next four weeks, or another read's window (the counts would mix). `others`: the raid opponent's
 * read windows of the same week (issue 861), which may not meet these either.
 */
export const timesRefusal = (
  times: ShieldTimes,
  cfg: ScheduleConfig,
  now: Date,
  others: (day: string) => Span[] = () => [],
) => clash((day) => [...readSpans(day, cfg, times), ...others(day)], cfg, now);

/** The times each read may be given now: those of `timeRanges` whose window meets no event's. */
export function timeChoices(cfg: ScheduleConfig, now: Date) {
  const r = timeRanges(cfg);
  const free = (spanOf: (day: string) => Span) => clash((day) => [spanOf(day)], cfg, now) === null;
  return {
    night: r.night.filter((night) =>
      free((day) => passWindows(day, cfg, { ...DEFAULT_TIMES, night }).night),
    ),
    morning: r.morning.filter((morning) =>
      free((day) => passWindows(day, cfg, { ...DEFAULT_TIMES, morning }).morning),
    ),
    reset: r.reset.filter((reset) => free((day) => resetWindow(day, cfg, reset))),
  };
}
