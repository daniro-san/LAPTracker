// The alliance's week in one line (issue 466, D76), pure: from the end-of-day reads Members already holds,
// how many reached the 1,000 Alliance Help coin cap and the median of the daily quest points on the newest
// read's day, and the donations of that read's game week added up. Alliance-level numbers only: nobody is
// named or ranked. A null on a read that lists a member is none that day (D127); a day with no read is
// left out and named, never 0 (D75).
import type { RosterRead } from "../repo/workspace-rosters";
import { median, pulseOf, type Median, type Share } from "./insights-rules";
import { gameWeek } from "./member-week";

export interface AllianceWeek {
  /** The newest end-of-day read's server day: the coins and quest points are that day's. */
  day: string;
  /** Members at the 1,000 coin cap, out of the members the read lists. */
  coins: Share | null;
  /** The median daily quest points of the members who did daily quests; null when nobody did. */
  quests: Median | null;
  /** The newest read's game week (its Monday). */
  monday: string;
  /** The week's donations added up over its reads; null when none was sent. */
  donations: number | null;
  /** Days of that week that should have a read by now and have none, oldest first. */
  noRead: string[];
}

/** The line's numbers from `reads` (oldest first), as of `today` (server day); null before any read. */
export function allianceWeek(reads: readonly RosterRead[], today: string): AllianceWeek | null {
  const newest = reads.at(-1);
  if (!newest) return null;
  const week = gameWeek(newest.day);
  const inWeek = reads.filter((r) => week.includes(r.day));
  const gifts = inWeek.flatMap((r) => r.members.flatMap((m) => m.dailyTech ?? []));
  const read = new Set(inWeek.map((r) => r.day));
  return {
    day: newest.day,
    coins: pulseOf([newest]).coins,
    quests: median(
      newest.members.flatMap((m) => ((m.active ?? 0) > 0 ? [m.active as number] : [])),
    ),
    monday: week[0] as string,
    donations: gifts.length === 0 ? null : gifts.reduce((a, b) => a + b, 0),
    // Today's read runs at the end of the day, so today is never "no read" yet.
    noRead: week.filter((d) => !read.has(d) && (d <= newest.day || d < today)),
  };
}
