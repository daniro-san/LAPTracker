// Main squad might and AD Tech over time (issue 347, D109; weekly baseline, issue 404, D114), pure: a
// member's newest version and the one before it (the card's "+400K since Nov 10"), the value saved before
// the game week began (the card's "+600K this week"), and the week's progress the thanks name (AD Tech
// reached 100 %, main squad grew by SQUAD_GROWTH or more over the value before the week). The facts are
// append-only (D80), so the history is the versions themselves. A value with nothing before it is compared
// with nothing (D75).
import type { FactRow } from "../repo/member-facts";
import { addDays, dayIn, mondayOf, weekdayIndex } from "./calendar-time";
import { AD_COMPLETE } from "./fact-fields";

export const TREND_FIELDS = ["squadMight", "adTech"] as const;
export type TrendField = (typeof TREND_FIELDS)[number];

/** Main squad might saved this week at least this share above its value before the week is thanked (D109). */
export const SQUAD_GROWTH = 0.05;

export interface Version {
  value: number | null;
  at: Date;
}

const versionOf = (r: FactRow): Version => ({
  value: typeof r.value === "number" ? r.value : null,
  at: r.writtenAt,
});

/** One member's versions of `field`, oldest first (`history` comes oldest first per member and field). */
const versionsOf = (history: readonly FactRow[], uid: number, field: TrendField) =>
  history.filter((r) => r.uid === uid && r.field === field).map(versionOf);

/** The newest version of a member's field and the one before it; null when there is none. */
export function lastTwo(
  history: readonly FactRow[],
  uid: number,
  field: TrendField,
): { now: Version; before: Version | null } | null {
  const versions = versionsOf(history, uid, field);
  const now = versions.at(-1);
  return now ? { now, before: versions.at(-2) ?? null } : null;
}

/**
 * The week the thanks cover, from today's server day (D114): the current game week, except on a Monday,
 * which still covers last week so the weekly appreciation post is not made from an almost empty week.
 */
export const thanksWeek = (today: string): string =>
  weekdayIndex(today) === 0 ? addDays(today, -7) : mondayOf(today);

/** Sunday and Monday (server days): when the leader usually writes the weekly appreciation post. */
export const appreciationDay = (today: string): boolean => [0, 6].includes(weekdayIndex(today));

/** A member's field split around the week that starts on server day `monday`. */
function aroundWeek(versions: Version[], monday: string, zone: string) {
  const end = addDays(monday, 7);
  const day = (v: Version) => dayIn(zone, v.at.getTime());
  return {
    /** The last version saved before Monday 00:00 ST. */
    base: versions.filter((v) => day(v) < monday).at(-1) ?? null,
    /** The newest version saved in the week. */
    now: versions.filter((v) => day(v) >= monday && day(v) < end).at(-1) ?? null,
  };
}

/**
 * The card's weekly baseline (D114): the value saved before the week of `monday` began, when the newest
 * version was saved in that week; null otherwise (the card then compares with the version before).
 */
export function weekBase(
  history: readonly FactRow[],
  uid: number,
  field: TrendField,
  monday: string,
  zone: string,
): Version | null {
  const versions = versionsOf(history, uid, field);
  const newest = versions.at(-1);
  if (!newest || dayIn(zone, newest.at.getTime()) < monday) return null;
  return aroundWeek(versions, monday, zone).base;
}

export interface Progress {
  uid: number;
  name: string;
  /** AD Tech reached 100 % this week, from a value below it before the week. */
  adDone: boolean;
  /** Main squad might's growth this week as a share (0.08 is +8 %); null below SQUAD_GROWTH or unknown. */
  squadGrowth: number | null;
}

/** AD Tech saved at 100 % in the week, when the value before the week was below 100. */
function reachedComplete(week: { base: Version | null; now: Version | null }): boolean {
  const was = week.base?.value ?? null;
  return week.now?.value === AD_COMPLETE && was !== null && was < AD_COMPLETE;
}

/** Main squad's growth over the week (newest in the week against the value before it), when notable. */
function grewNotably(week: { base: Version | null; now: Version | null }): number | null {
  const [now, base] = [week.now?.value ?? null, week.base?.value ?? null];
  if (now === null || base === null || base <= 0) return null;
  const growth = (now - base) / base;
  return growth >= SQUAD_GROWTH ? growth : null;
}

/**
 * The members to thank for the week that starts on server day `monday` (`zone` is SERVER_TZ): AD Tech
 * saved at 100 % in that week when the value before the week was below 100, and main squad might whose
 * newest value in that week is SQUAD_GROWTH or more above the last value saved before Monday 00:00 ST, so
 * 10.0M → 10.3M → 10.6M in one week counts as +6 % (D114). Versions saved after the week are not read, so
 * last week's thanks on a Monday stay last week's. Without a value from before the week, nobody is named
 * and nobody is counted (D75). In name order: progress is not a ranking.
 */
export function progressOf(
  history: readonly FactRow[],
  members: readonly { uid: number; name: string }[],
  monday: string,
  zone: string,
): Progress[] {
  return members
    .flatMap((m) => {
      const ad = aroundWeek(versionsOf(history, m.uid, "adTech"), monday, zone);
      const squad = aroundWeek(versionsOf(history, m.uid, "squadMight"), monday, zone);
      const adDone = reachedComplete(ad);
      const squadGrowth = grewNotably(squad);
      return adDone || squadGrowth !== null
        ? [{ uid: m.uid, name: m.name, adDone, squadGrowth }]
        : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
