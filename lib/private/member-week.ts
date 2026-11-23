// The Members tab's arithmetic (issue #296, D75), pure: the game week of an alliance's end-of-day reads,
// each member's donations per server day and the week's total, a day's and the week's daily quest points,
// the offline proxy, who is new, what is missing, and the week's thanks. Data that was not captured is
// null: shown as "—", never 0, never counted.
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
const previousDay = (day: string) => isoDay(dayMs(day) - DAY_MS);

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

/** Per day of `week`, the member's donations (`daily_tech`) in that day's end-of-day read. */
export function weekDonations(
  reads: readonly RosterRead[],
  week: string[],
  uid: number,
): DayValue[] {
  const newest = reads.at(-1)?.day ?? "";
  return week.map((day) => {
    if (day > newest) return "later";
    const member = reads.find((r) => r.day === day)?.members.find((m) => m.uid === uid);
    return member ? (member.dailyTech ?? "none") : null;
  });
}

/** The sum of the days with data; null when no day has any (D75: a day with no data never counts). */
export function weekTotal(days: DayValue[]): number | null {
  const known = days.filter((d): d is number => typeof d === "number");
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}

/**
 * The most daily quest points a member can earn in one server day: 240, so 1,680 a week (7 × 240).
 * PROVISIONAL, not confirmed by the owner, who thinks it may be 230 (#739): every end-of-day read fits 240
 * (Tuesday reads at 480, Sunday reads above 7 × 230 = 1,610), and those do not fit 230. The quest points
 * bars are drawn against it (D158, amended 2026-11-22).
 */
export const QUEST_DAY_CAP = 240;

/** A day's daily quest points: a number, "none" (none earned that day), or null (no data). */
export type QuestDay = number | "none" | null;

/**
 * A day's daily quest points from the game's `active`, which is not a day's value: it is the quest points
 * since the week's reset, Monday at the daily reset (D127, amended 2026-11-22, #739). `total` is `active` on
 * `day`'s end-of-day read and `before` on the read of the server day before, each null when no read of that
 * day lists the member; a read that lists the member with `active` null counts as 0 so far this week.
 * - On a Monday the day's points are `total` itself: the count starts at 0 at the reset.
 * - On any other day they are `total − before`. With no read of the day before they are no data (null),
 *   never 0 (D75), unless `total` is 0: nothing yet this week, so nothing that day either.
 * - 0 is "none" (#663: it counts as 0 in averages and is written "none"); a drop inside one week has no
 *   meaning, so it is no data too.
 */
export function questDay(day: string, total: number | null, before: number | null): QuestDay {
  if (total === null) return null;
  const base = gameWeek(day)[0] === day ? 0 : before;
  if (base === null) return total === 0 ? "none" : null;
  const points = total - base;
  return points < 0 ? null : points === 0 ? "none" : points;
}

/** The member's `active` on the read of `day`: 0 for null on a read that lists them; null for no such read. */
function totalOn(reads: readonly RosterRead[], day: string, uid: number): number | null {
  const m = reads.find((r) => r.day === day)?.members.find((x) => x.uid === uid);
  return m ? (m.active ?? 0) : null;
}

/** The member's daily quest points on `day` (`questDay`), from the alliance's end-of-day reads. */
export const questPoints = (reads: readonly RosterRead[], uid: number, day: string): QuestDay =>
  questDay(day, totalOn(reads, day, uid), totalOn(reads, previousDay(day), uid));

/**
 * The member's daily quest points in the newest read's game week (D127, amended 2026-11-22, #739): `active`
 * on the newest read of that week that lists them, which already holds the week so far. Thanks and picks
 * use the week, not one day's number. Null when no read of the week lists them or the week has none.
 */
export function weekQuestPoints(reads: readonly RosterRead[], uid: number): number | null {
  const week = gameWeek(reads.at(-1)?.day ?? "1970-01-01");
  const total = reads
    .filter((r) => week.includes(r.day))
    .findLast((r) => r.members.some((m) => m.uid === uid))
    ?.members.find((m) => m.uid === uid)?.active;
  return total ? total : null;
}

/** The offline proxy's evidence (D75): the end-of-day reads in a row with nothing that day. */
export interface Idle {
  days: number;
}

/**
 * No daily quest points that day (`questPoints` is "none") and no donations (`daily_tech` null) on end-of-day
 * reads of consecutive server days that list the member, counted back from the newest read (D127, amended
 * 2026-11-22, #739). The game sends null, never 0, so a null `daily_tech` on a read that succeeded and lists
 * the member is "nothing today". `reads` holds only reads that succeeded: a failed or missing day ends the
 * run, and so do a read that does not list the member and a day whose quest points are no data. Null when
 * the run is shorter than IDLE_READS.
 */
export function idleRun(reads: RosterRead[], uid: number): Idle | null {
  let days = 0;
  for (let i = reads.length - 1; i >= 0; i--) {
    const read = reads[i] as RosterRead;
    const later = reads[i + 1];
    if (later && nextDay(read.day) !== later.day) break;
    const m = read.members.find((x) => x.uid === uid);
    if (!m || m.dailyTech !== null || questPoints(reads, uid, read.day) !== "none") break;
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
