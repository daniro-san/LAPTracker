// The Raid Shield check's rules (issue 474, D137), pure: no IO, `now` passed in. When its two reads run and
// what one tracker reading of a member says. It never says how long a seen shield lasts: `shield_type` 0
// was seen for an 8 h and a 24 h shield (owner, 2026-11-21).
//
// The raid starts at the server reset (00:00 ST) on the night before KvK, and KvK starts at 12:00 ST on
// Saturday; nobody keeps a shield after that (owner, 2026-11-20). So: one read of the whole alliance from
// Friday 23:30 ST that must end before 00:00 ST, and one on Saturday morning (10:00 ST by default, a setting
// between 10:00 and 11:00) that must end before 12:00 ST. Nothing runs after 12:00 ST.
//
// The shield comes from the tracker's map scan (`map_updated_at`), not from the read itself: `fresh` does
// not refresh it (owner's test, 2026-11-20). A shield turned on after the last scan is "not seen yet", a
// hint and never a ✗ (D75).
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
