// The Raid Shield check's rules (issue 474, D137), pure: no IO, `now` passed in. When its two reads run and
// what one tracker reading of a member says. It never says how long a seen shield lasts: `shield_type` 0
// was seen for an 8 h and a 24 h shield (owner, 2026-11-21).
//
// The raid starts at the server reset (00:00 ST) on the night before KvK, and KvK starts at 12:00 ST on
// Saturday; nobody keeps a shield after that (owner, 2026-11-20). So: one read of the whole alliance from
// Friday 23:30 ST that must end before 00:00 ST, one at Saturday 02:30 ST after the reset (issue 827), and
// one on Saturday morning (10:00 ST by default, a setting between 10:00 and 11:00) that must end before
// 12:00 ST. Nothing runs after 12:00 ST.
//
// The shield comes from the tracker's map scan (`map_updated_at`), not from the read itself: `fresh` does
// not refresh it (owner's test, 2026-11-20). A shield turned on after the last scan is "not seen yet", a
// hint and never a ✗ (D75).
import { addDays, hhmm, mondayOf } from "./calendar-time";
import {
  quotaDayRead,
  serverInstant,
  serverMinuteOfDay,
  serverWeekday,
  type ScheduleConfig,
} from "./schedule";

type Cfg = Pick<ScheduleConfig, "SERVER_TZ" | "DAILY_ROSTER_AT">;

/** Friday's read starts at the 23:30 ST tick, right after the daily roster read (D72). */
export const NIGHT_MINUTE = 23 * 60 + 30;
/** The morning read's earliest and latest start (owner: between 10:00 and 11:00 ST). */
export const MORNING_MIN = 10 * 60;
export const MORNING_MAX = 11 * 60;
/** KvK starts at 12:00 ST on Saturday: no shield read after it. */
export const KVK_MINUTE = 12 * 60;
/** The most calls one morning read makes, retries included: the squads read's cap (D132). */
export const SHIELD_CALLS_MAX = 120;

const FRIDAY = 5;
const SATURDAY = 6;

export type ShieldPass = "night" | "morning";

/**
 * Which read may run at `now`, with its quota day (`day`, the daily read's date: Friday's) and the instant
 * it must end by: Friday from 23:30 ST until 00:00 ST, Saturday from `morningMinute` until 12:00 ST.
 */
export function shieldPassAt(
  now: Date,
  cfg: Cfg,
  morningMinute: number,
): { pass: ShieldPass; day: string; endsAt: Date } | null {
  const weekday = serverWeekday(now, cfg);
  const minute = serverMinuteOfDay(now, cfg);
  const day = quotaDayRead(now, cfg);
  const saturday = addDay(day);
  if (weekday === FRIDAY && minute >= NIGHT_MINUTE)
    return { pass: "night", day, endsAt: serverInstant(saturday, "00:00", cfg) };
  if (weekday === SATURDAY && minute >= morningMinute && minute < KVK_MINUTE)
    return { pass: "morning", day, endsAt: kvkStart(day, cfg) };
  return null;
}

/**
 * Whether either read could run at `now` for any alliance (the earliest morning time): the tick looks at
 * no workspace outside these windows.
 */
export const shieldWindowOpen = (now: Date, cfg: Cfg) =>
  shieldPassAt(now, cfg, MORNING_MIN) !== null;

const addDay = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** KvK's start after the check of Friday `day`: Saturday 12:00 ST. */
export const kvkStart = (day: string, cfg: Pick<ScheduleConfig, "SERVER_TZ">) =>
  serverInstant(addDay(day), "12:00", cfg);

/** The Friday whose night the roll call of `day` prepares: that week's (Monday + 4). */
export const fridayOf = (day: string) => addDays(mondayOf(day), 4);

/**
 * The raid a Raid prep roll call of server day `day` prepares (D137): its week's Friday, the Saturday of the
 * reset that starts the raid (00:00 ST) and of KvK's start (12:00 ST). Raid prep's page, a member's own
 * page and the member card (issue 634: from `night`, the night check's start, until `kvk`) all count from
 * it, so they never disagree on a roll call added on another day.
 */
export function raidOf(day: string, cfg: Pick<ScheduleConfig, "SERVER_TZ">) {
  const friday = fridayOf(day);
  const saturday = addDay(friday);
  return {
    friday,
    saturday,
    night: serverInstant(friday, hhmm(NIGHT_MINUTE), cfg),
    reset: serverInstant(saturday, "00:00", cfg),
    kvk: kvkStart(friday, cfg),
  };
}

/**
 * The after-reset check (issue 827, D137 2026-11-28b): one read of every member on the ticks that fall in
 * Saturday 02:30–03:00 ST (02:30, and 02:45 for what 02:30 left), when most maps are from after the reset
 * (the probes of issue 726).
 */
export const RESET_FROM = 2 * 60 + 30;
export const RESET_TO = 3 * 60;

/** Whether an after-reset check's tick is now: Saturday 02:30–03:00 ST. */
export function resetReadDue(now: Date, cfg: Pick<ScheduleConfig, "SERVER_TZ">): boolean {
  const minute = serverMinuteOfDay(now, cfg);
  return serverWeekday(now, cfg) === SATURDAY && minute >= RESET_FROM && minute < RESET_TO;
}

/**
 * Where the after-reset check's answers fall, for the check of Friday `day`: Saturday 02:30–03:15 ST (its
 * window's last tick plus the tick's 180 s budget ends by 03:03). Apart from `passWindows`, so the night
 * and morning counts, the summary, the pushes and the fill never count it; Raid prep reads it.
 */
export function resetWindow(day: string, cfg: Pick<ScheduleConfig, "SERVER_TZ">) {
  const saturday = addDay(day);
  return {
    from: serverInstant(saturday, hhmm(RESET_FROM), cfg),
    to: serverInstant(saturday, "03:15", cfg),
  };
}

/** The morning read's start time, kept inside 10:00–11:00 ST. */
export const morningMinuteOf = (minute: number | null | undefined) =>
  Math.min(MORNING_MAX, Math.max(MORNING_MIN, minute ?? MORNING_MIN));

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
 * Where each read's answers fall, for the check of Friday `day`: the night from 23:00 ST to 00:00 ST, the
 * morning from 10:00 ST to 12:00 ST (KvK). A member's newest reading inside a window is that read's.
 */
export function passWindows(day: string, cfg: Pick<ScheduleConfig, "SERVER_TZ">) {
  const saturday = addDay(day);
  return {
    night: { from: serverInstant(day, "23:00", cfg), to: serverInstant(saturday, "00:00", cfg) },
    morning: { from: serverInstant(saturday, "10:00", cfg), to: kvkStart(day, cfg) },
  };
}
