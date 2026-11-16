// The Members tab's arithmetic (issue #296, D75), pure: the game week of an alliance's end-of-day reads,
// each member's donations per server day and the week's total, the offline proxy, who is new, what is
// missing, and the week's thanks. Data that was not captured is null: shown as "—", never 0, never counted.
import type { RosterMember, RosterRead } from "../repo/workspace-rosters";

/** A member first seen in the alliance less than this many days before the newest read is new (D70's 14). */
export const NEW_MEMBER_DAYS = 14;
/** Day-to-day steps with activity and donations unchanged before the offline proxy is a reason (D75). */
export const IDLE_STEPS = 2;
/** Names in each thanks list. */
export const THANKS_SIZE = 3;

const DAY_MS = 86_400_000;
const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const nextDay = (day: string) => isoDay(dayMs(day) + DAY_MS);
const isMonday = (day: string) => new Date(dayMs(day)).getUTCDay() === 1;

/** The seven server days, Monday to Sunday (the game's week, owner's prototype v5), that hold `day`. */
export function gameWeek(day: string): string[] {
  const monday = dayMs(day) - ((new Date(dayMs(day)).getUTCDay() + 6) % 7) * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => isoDay(monday + i * DAY_MS));
}

/** A day's donations: a number, null for no data (no read, or the game sent none), "later" for not read yet. */
export type DayValue = number | null | "later";

/** Per day of `week`, the member's donations (`daily_tech`) in that day's end-of-day read. */
export function weekDonations(reads: RosterRead[], week: string[], uid: number): DayValue[] {
  const newest = reads.at(-1)?.day ?? "";
  return week.map((day) => {
    if (day > newest) return "later";
    const read = reads.find((r) => r.day === day);
    return read?.members.find((m) => m.uid === uid)?.dailyTech ?? null;
  });
}

/** The sum of the days with data; null when no day has any (D75: a day with no data never counts). */
export function weekTotal(days: DayValue[]): number | null {
  const known = days.filter((d): d is number => typeof d === "number");
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0);
}

/** The offline proxy's evidence (D75): how long activity and donations held, and at what. */
export interface Idle {
  /** Day-to-day steps with nothing changed, newest first; the reads compared are one more. */
  days: number;
  activity: number;
  donated: number;
}

type Known = RosterMember & { active: number; dailyTech: number };
const known = (m: RosterMember | undefined): m is Known =>
  m !== undefined && m.active !== null && m.dailyTech !== null;

/**
 * Weekly activity (`active`) and donations (`daily_tech`) unchanged between end-of-day reads of
 * consecutive server days, counted back from the newest read. Monday's reset of the weekly activity is
 * ignored: on a Monday the activity is compared with 0. A missing day, or a null on either side, ends the
 * run. Null when the run is shorter than IDLE_STEPS.
 */
export function idleRun(reads: RosterRead[], uid: number): Idle | null {
  let steps = 0;
  for (let i = reads.length - 1; i > 0; i--) {
    const [before, after] = [reads[i - 1] as RosterRead, reads[i] as RosterRead];
    const [was, now] = [
      before.members.find((m) => m.uid === uid),
      after.members.find((m) => m.uid === uid),
    ];
    if (nextDay(before.day) !== after.day || !known(was) || !known(now)) break;
    const base = isMonday(after.day) ? 0 : was.active;
    if (now.active !== base || now.dailyTech !== was.dailyTech) break;
    steps++;
  }
  const newest = reads.at(-1)?.members.find((m) => m.uid === uid);
  if (steps < IDLE_STEPS || !known(newest)) return null;
  return { days: steps, activity: newest.active, donated: newest.dailyTech };
}

/**
 * New: first seen in the alliance after its oldest usable roster, and less than NEW_MEMBER_DAYS before
 * the newest read. A member already in the oldest roster predates the records, so is not new.
 */
export function isNewMember(
  firstSeen: string | undefined,
  oldest: string,
  newest: string,
): boolean {
  if (firstSeen === undefined || firstSeen <= oldest) return false;
  return dayMs(newest) - dayMs(firstSeen) < NEW_MEMBER_DAYS * DAY_MS;
}

export type MissingField = "might" | "sanctuary" | "activity" | "donations";

/** What the newest read did not tell about a member, and the days of the week so far with no donations. */
export function missingOf(
  m: RosterMember,
  days: DayValue[],
): { fields: MissingField[]; days: number } {
  const noDays = days.filter((d) => d === null).length;
  const fields: MissingField[] = [];
  if (m.power === null) fields.push("might");
  if (m.lv === null) fields.push("sanctuary");
  if (m.active === null) fields.push("activity");
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
