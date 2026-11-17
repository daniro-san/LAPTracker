// Caravan suggestions (issues 300, 354), pure: up to three members for an Alliance Caravan's seats. Most
// active this week first (the roster's weekly `active`, D71/D76: the workspace's own alliance only, never
// logged), then whoever waited longest since their last caravan role; a member who never had one waited
// longest. Not suggested: members away on that day (D80), anyone with a caravan role in the 7 days up to
// it, and anyone already seated on this caravan. People-first (D75): the reasons say what is good, never
// who did least, and a missing value is never a reason (an unknown activity sorts after the known ones).
import { daysBetween } from "./calendar-time";

export const SUGGESTIONS = 3;
/** A role this many days or fewer before the caravan keeps a member out of its suggestions. */
export const RECENT_DAYS = 7;

export interface Candidate {
  uid: number;
  name: string;
  /** Weekly activity from the newest end-of-day read; null when not known. */
  active: number | null;
  /** On a break, or an away note that runs on the caravan's day. */
  away: boolean;
}

/** A seat held on an Alliance Caravan: who, on which server day, and which caravan week (`entry:week`). */
export interface Role {
  uid: number;
  day: string;
  key: string;
}

export interface Suggestion {
  uid: number;
  name: string;
  /** True only when this week's activity is known and above zero. */
  activeThisWeek: boolean;
  /** Days since the last caravan role before this one; null for no role yet. */
  lastRoleDays: number | null;
}

/** The suggestions for the caravan `key` on server day `day`, whose seats hold `seated`. */
export function suggest(
  candidates: readonly Candidate[],
  roles: readonly Role[],
  caravan: { key: string; day: string; seated: readonly number[] },
): Suggestion[] {
  const last = new Map<number, string>();
  for (const r of roles) {
    if (r.key === caravan.key || r.day > caravan.day) continue;
    if ((last.get(r.uid) ?? "") < r.day) last.set(r.uid, r.day);
  }
  const gap = (uid: number) => {
    const day = last.get(uid);
    return day === undefined ? null : daysBetween(day, caravan.day);
  };
  return candidates
    .filter((c) => !c.away && !caravan.seated.includes(c.uid))
    .filter((c) => {
      const days = gap(c.uid);
      return days === null || days > RECENT_DAYS;
    })
    .sort(
      (a, b) =>
        (b.active ?? -1) - (a.active ?? -1) ||
        (gap(b.uid) ?? Infinity) - (gap(a.uid) ?? Infinity) ||
        a.name.localeCompare(b.name),
    )
    .slice(0, SUGGESTIONS)
    .map((c) => ({
      uid: c.uid,
      name: c.name,
      activeThisWeek: (c.active ?? 0) > 0,
      lastRoleDays: gap(c.uid),
    }));
}
