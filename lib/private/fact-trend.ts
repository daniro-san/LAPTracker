// Main squad might and AD Tech over time (issue 347, D109), pure: a member's newest version and the one
// before it (the card's "+400K since Nov 10", "+5 points since Nov 10"), and the week's progress the thanks
// name (AD Tech reached 100 %, main squad grew by SQUAD_GROWTH or more over that same version before). The
// facts are append-only (D80), so the history
// is the versions themselves. A value with nothing before it is compared with nothing (D75).
import type { FactRow } from "../repo/member-facts";
import { dayIn } from "./calendar-time";
import { AD_COMPLETE } from "./fact-fields";

export const TREND_FIELDS = ["squadMight", "adTech"] as const;
export type TrendField = (typeof TREND_FIELDS)[number];

/** Main squad might saved this week at least this share above its version before is thanked (D109). */
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

export interface Progress {
  uid: number;
  name: string;
  /** AD Tech reached 100 % this week, from a value below it. */
  adDone: boolean;
  /** Main squad might's growth this week as a share (0.08 is +8 %); null below SQUAD_GROWTH or unknown. */
  squadGrowth: number | null;
}

/** AD Tech saved at 100 % this week, from a version below 100 just before it. */
function reachedComplete(versions: Version[], thisWeek: (v: Version) => boolean): boolean {
  const [now, before] = [versions.at(-1), versions.at(-2)];
  const was = before?.value ?? null;
  return (
    now !== undefined &&
    now.value === AD_COMPLETE &&
    thisWeek(now) &&
    was !== null &&
    was < AD_COMPLETE
  );
}

/**
 * Main squad's growth when its newest version was saved this week, over the version before it (the same
 * pair the card's "+400K since Nov 10" compares), when SQUAD_GROWTH or more; else null.
 */
function grewNotably(versions: Version[], thisWeek: (v: Version) => boolean): number | null {
  const [now, before] = [versions.at(-1), versions.at(-2)];
  const base = before?.value ?? null;
  if (!now || now.value === null || !thisWeek(now) || base === null || base <= 0) return null;
  const growth = (now.value - base) / base;
  return growth >= SQUAD_GROWTH ? growth : null;
}

/**
 * The members to thank for the week that starts on server day `monday` (`zone` is SERVER_TZ): AD Tech
 * saved at 100 % this week when the version before it was below 100, and main squad might saved this week
 * at SQUAD_GROWTH or more above the version before it. Without a value to compare with, nobody is named
 * and nobody is counted (D75). In name order: progress is not a ranking.
 */
export function progressOf(
  history: readonly FactRow[],
  members: readonly { uid: number; name: string }[],
  monday: string,
  zone: string,
): Progress[] {
  const thisWeek = (v: Version) => dayIn(zone, v.at.getTime()) >= monday;
  return members
    .flatMap((m) => {
      const adDone = reachedComplete(versionsOf(history, m.uid, "adTech"), thisWeek);
      const squadGrowth = grewNotably(versionsOf(history, m.uid, "squadMight"), thisWeek);
      return adDone || squadGrowth !== null
        ? [{ uid: m.uid, name: m.name, adDone, squadGrowth }]
        : [];
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
