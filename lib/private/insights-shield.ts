// The Insights page's Raid Shield history (issue 489 part 3, D139), pure: which weeks it shows and what each
// week's two checks counted (D137: the night check from Friday 23:30 ST, the morning check on Saturday).
// Alliance-level counts only: no name, no ranking, no list of who was not seen (D75). A check that did not
// run, or read nobody, is "no reading", never 0 %. A reading is the tracker's map scan: a shield turned on
// after it does not show.
import type { PassCount } from "../repo/shield-checks";
import { passWindows } from "../shield-check";
import { addDays, mondayOf } from "./calendar-time";

/** The weeks shown, the newest first. */
export const SHIELD_WEEKS = 8;

export interface PassShare {
  /** Friday's roster. */
  roster: number;
  /** Members whose reading said shielded or not; the rest were not read. */
  read: number;
  seen: number;
  /** The morning check is still under way: its counts so far, no share yet. */
  running: boolean;
}

export interface ShieldWeek {
  /** The Friday of the raid night (the check's day). */
  friday: string;
  night: PassShare | null;
  morning: PassShare | null;
}

/**
 * The SHIELD_WEEKS Fridays shown, the newest first: this week's once its night window opened (Friday
 * 23:00 ST, `passWindows`), else last week's.
 */
export function shieldFridays(today: string, now: Date, zone: string): string[] {
  const friday = addDays(mondayOf(today), 4);
  const opened =
    friday <= today &&
    now.getTime() >= passWindows(friday, { SERVER_TZ: zone }).night.from.getTime();
  const newest = opened ? friday : addDays(friday, -7);
  return Array.from({ length: SHIELD_WEEKS }, (_, i) => addDays(newest, -7 * i));
}

/** Each Friday's two read windows, for `shieldPassCounts`. */
export const shieldWindows = (fridays: string[], zone: string) =>
  fridays.flatMap((day) => {
    const w = passWindows(day, { SERVER_TZ: zone });
    return (["night", "morning"] as const).map((pass) => ({ day, pass, ...w[pass] }));
  });

/** The weeks, the newest first; a finished check that read nobody is no reading (D75). */
export function shieldWeeksOf(fridays: string[], counts: PassCount[]): ShieldWeek[] {
  const share = (friday: string, pass: PassCount["pass"]): PassShare | null => {
    const c = counts.find((x) => x.day === friday && x.pass === pass);
    return c && (c.read > 0 || c.running)
      ? { roster: c.roster, read: c.read, seen: c.seen, running: c.running }
      : null;
  };
  return fridays.map((friday) => ({
    friday,
    night: share(friday, "night"),
    morning: share(friday, "morning"),
  }));
}
