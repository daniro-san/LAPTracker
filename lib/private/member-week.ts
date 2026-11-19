// The Members tab's arithmetic (issue #296, D75), pure: the game week of an alliance's end-of-day reads,
// each member's donations per server day and the week's total, the week's daily quest points, the offline
// proxy, who is new, what is missing, and the week's thanks. Data that was not captured is null: shown as
// "—", never 0, never counted.
import { NEW_MEMBER_DAYS } from "../queries/might-unchanged";
import type { RosterMember, RosterRead } from "../repo/workspace-rosters";

/**
 * End-of-day reads in a row with no daily quest points and no donations before the offline proxy is a
 * reason (D75, D127): 3 reads, the owner's "offline for more than 2 days".
 */
export const IDLE_READS = 3;
/** End-of-day reads that cover a game week, for `weekQuestPoints`. */
export const WEEK_READS = 7;
/** Names in each thanks list. */
export const THANKS_SIZE = 3;
/**
 * D75's "zero kills in a KvK with no away note recorded" is held: away notes arrive with #297/#298, and
 * without them about 46 of OGs' 101 members would carry it (KvK 2026-11-14, #271). The read and the
 * test stay; `membersView` adds the reason only when this is true.
 */
export const KVK_REASON_ON: boolean = false;

export const DAY_MS = 86_400_000;
const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
/** A day as YYYY-MM-DD (UTC). */
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const nextDay = (day: string) => isoDay(dayMs(day) + DAY_MS);

/** The seven server days, Monday to Sunday (the game's week, owner's prototype v5), that hold `day`. */
export function gameWeek(day: string): string[] {
  const monday = dayMs(day) - ((new Date(dayMs(day)).getUTCDay() + 6) % 7) * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => isoDay(monday + i * DAY_MS));
}

/**
 * A day's value: a number; "none" when that day's read lists the member and the game sent null, nothing
 * that day (D127); null for no data (no read, or a read that does not list the member); "later" for not
 * read yet.
 */
export type DayValue = number | "none" | null | "later";

/** Per day of `week`, the member's `field` in that day's end-of-day read. */
function weekDays(
  reads: readonly RosterRead[],
  week: string[],
  uid: number,
  field: "dailyTech" | "active",
): DayValue[] {
  const newest = reads.at(-1)?.day ?? "";
  return week.map((day) => {
    if (day > newest) return "later";
    const member = reads.find((r) => r.day === day)?.members.find((m) => m.uid === uid);
    return member ? (member[field] ?? "none") : null;
  });
}

/** Per day of `week`, the member's donations (`daily_tech`) in that day's end-of-day read. */
export const weekDonations = (reads: readonly RosterRead[], week: string[], uid: number) =>
  weekDays(reads, week, uid, "dailyTech");

/** The sum of the days with data; null when no day has any (D75: a day with no data never counts). */
export function weekTotal(days: DayValue[]): number | null {
  const known = days.filter((d): d is number => typeof d === "number");
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}

/**
 * The member's daily quest points (`active`) summed over the days of the newest read's game week that
 * have a read (D127): thanks and picks use the week, not one day's number. Null when no day has any.
 */
export function weekQuestPoints(reads: readonly RosterRead[], uid: number): number | null {
  const newest = reads.at(-1);
  return newest ? weekTotal(weekDays(reads, gameWeek(newest.day), uid, "active")) : null;
}

/** The offline proxy's evidence (D75): the end-of-day reads in a row with nothing that day. */
export interface Idle {
  days: number;
}

/**
 * Daily quest points (`active`) and donations (`daily_tech`) both null on end-of-day reads of consecutive
 * server days that list the member, counted back from the newest read (D127). The game sends null, never
 * 0, so null on a read that succeeded and lists the member is "nothing today". `reads` holds only reads
 * that succeeded: a failed or missing day ends the run, and so does a read that does not list the member.
 * Null when the run is shorter than IDLE_READS.
 */
export function idleRun(reads: RosterRead[], uid: number): Idle | null {
  let days = 0;
  for (let i = reads.length - 1; i >= 0; i--) {
    const read = reads[i] as RosterRead;
    const later = reads[i + 1];
    if (later && nextDay(read.day) !== later.day) break;
    const m = read.members.find((x) => x.uid === uid);
    if (!m || m.active !== null || m.dailyTech !== null) break;
    days++;
  }
  return days < IDLE_READS ? null : { days };
}

/** D127: a member first seen less than this many days ago never gets the offline signal (owner, 2026-11-20). */
export const OFFLINE_GRACE_DAYS = 7;

/**
 * New: first seen in the alliance after its oldest usable roster, and less than `days` (NEW_MEMBER_DAYS
 * by default) before the newest read. A member already in the oldest roster predates the records, so is not new.
 */
export function isNewMember(
  firstSeen: string | undefined,
  oldest: string,
  newest: string,
  days: number = NEW_MEMBER_DAYS,
): boolean {
  if (firstSeen === undefined || firstSeen <= oldest) return false;
  return dayMs(newest) - dayMs(firstSeen) < days * DAY_MS;
}

export type MissingField = "might" | "sanctuary" | "donations";

/**
 * What the newest read did not tell about a member, and the days of the week so far with no read of them.
 * A null `active` or `daily_tech` on a read that lists the member is not missing (D127): it is none that day.
 */
export function missingOf(
  m: RosterMember,
  days: DayValue[],
): { fields: MissingField[]; days: number } {
  const noDays = days.filter((d) => d === null).length;
  const fields: MissingField[] = [];
  if (m.power === null) fields.push("might");
  if (m.lv === null) fields.push("sanctuary");
  if (noDays > 0) fields.push("donations");
  return { fields, days: noDays };
}

export interface Thank {
  uid: number;
  name: string;
  value: number;
}

/** The THANKS_SIZE biggest positive values, new members left out (D75: no comparison holds them). */
export function topOf<T extends { uid: number; name: string; isNew: boolean }>(
  rows: T[],
  value: (row: T) => number | null,
): Thank[] {
  return rows
    .filter((r) => !r.isNew)
    .map((r) => ({ uid: r.uid, name: r.name, value: value(r) ?? 0 }))
    .filter((t) => t.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, THANKS_SIZE);
}
