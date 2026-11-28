// "Steady effort" thanks (issue 465, D75, D127): who helped the alliance with all 1,000 Alliance Help coins
// (`daily_honor`) and who earned daily quest points (`active`) on every day of the thanks week that has a
// read. Pure, over the reads the Members view already loaded. A day with no read of the member never counts
// for or against them; with fewer than STEADY_READS days of data nobody is named.
import type { RosterRead } from "../repo/workspace-rosters";
import { COINS_MAX } from "./member-days";
import { questPoints } from "./member-week";

/** The least days with data a member needs for either deed (owner, 2026-11-19: "at least 5 reads"). */
export const STEADY_READS = 5;

export interface Steady {
  /** Every day with a read: all 1,000 Alliance Help coins. */
  help: boolean;
  /** Every day with a read: daily quest points above 0. */
  quests: boolean;
}

const every = (days: boolean[]) => days.length >= STEADY_READS && days.every(Boolean);

/** The member's two deeds over `week` (its server days), from `reads` (end-of-day reads of one alliance). */
export function steadyOf(
  reads: readonly RosterRead[],
  week: readonly string[],
  uid: number,
): Steady {
  const coins: boolean[] = [];
  const quests: boolean[] = [];
  for (const day of week) {
    const listed = reads.find((r) => r.day === day)?.members.find((m) => m.uid === uid);
    if (!listed) continue;
    // The game sends null for "nothing that day" (D127): it is 0 coins.
    coins.push((listed.dailyHonor ?? 0) >= COINS_MAX);
    const points = questPoints(reads, uid, day);
    if (points !== null) quests.push(points !== "none");
  }
  return { help: every(coins), quests: every(quests) };
}
