// Alliance Duel by week (issue 467): each member's points for the saved weeks, the alliance's weekly average
// and the members who improved most. The points are the "week" rows the screenshot import saved
// (`alliance_duel_points`). A week with no saved picture, or none for that member, is "no data": never a 0,
// never counted in an average or a comparison, never a reason to look at someone (D75).
import type { Db } from "../db";
import { duelWeekTotals } from "../repo/import";
import type { WorkspaceAccess } from "./access";
import { addDays } from "./calendar-time";

/** How many game weeks the card shows, the current one last. */
export const DUEL_WEEKS = 8;
/** A member is "most improved" at this share or more above their previous saved week. */
export const IMPROVED_BY = 0.1;

export interface DuelTotal {
  uid: number;
  /** The Monday of the game week. */
  week: string;
  points: number;
}

/** The Monday DUEL_WEEKS - 1 weeks before `week`: where the read starts. */
export const duelSince = (week: string) => addDays(week, -7 * (DUEL_WEEKS - 1));

/** The workspace's own saved week totals for the weeks the card covers; reads this workspace only. */
export const duelTotals = (db: Db, access: WorkspaceAccess, week: string): Promise<DuelTotal[]> =>
  duelWeekTotals(db, access.workspaceId, duelSince(week));

export interface DuelHistory {
  /** The weeks, oldest first; `points` is null when nothing was saved for the member that week. The last one is the week still running: shown, but in no average. */
  weeks: { week: string; points: number | null }[];
  /** The member's mean over the weeks that have points; null with none. */
  average: { value: number; weeks: number } | null;
  /** The mean of the alliance's weekly totals over the weeks that have data; null with none. */
  alliance: { value: number; weeks: number } | null;
}

const mean = (values: number[]) =>
  values.length === 0
    ? null
    : { value: values.reduce((a, b) => a + b, 0) / values.length, weeks: values.length };

/**
 * One member's weeks up to `week`, and the alliance's weekly average. Only `uids` (the alliance's members)
 * add to the alliance's totals. Null when none of them has a saved week: the card then shows nothing.
 */
export function duelHistory(
  rows: readonly DuelTotal[],
  uids: ReadonlySet<number>,
  uid: number,
  week: string,
): DuelHistory | null {
  const ours = rows.filter((r) => uids.has(r.uid));
  if (ours.length === 0) return null;
  const weeks = Array.from({ length: DUEL_WEEKS }, (_, i) =>
    addDays(week, -7 * (DUEL_WEEKS - 1 - i)),
  );
  const inWeeks = weeks.map((w) => ours.filter((r) => r.week === w));
  const own = inWeeks.map((rs) => rs.find((r) => r.uid === uid)?.points ?? null);
  // The week still running is partial: it counts in no average (owner, orchestrator decision on #467).
  const done = DUEL_WEEKS - 1;
  return {
    weeks: weeks.map((w, i) => ({ week: w, points: own[i] ?? null })),
    average: mean(own.slice(0, done).flatMap((p) => p ?? [])),
    alliance: mean(
      inWeeks
        .slice(0, done)
        .filter((rs) => rs.length > 0)
        .map((rs) => rs.reduce((a, r) => a + r.points, 0)),
    ),
  };
}

/**
 * The members to thank for improving: points in the newest finished week (before the Monday `current`, so a
 * week still running counts for nothing) at least IMPROVED_BY above their own previous finished week. Someone missing from either week is left out, not counted (D75). In name order:
 * this is not a ranking.
 */
export function mostImproved(
  rows: readonly DuelTotal[],
  members: readonly { uid: number; name: string }[],
  current: string,
): string[] {
  const mine = new Set(members.map((m) => m.uid));
  const ours = rows.filter((r) => mine.has(r.uid) && r.week < current);
  const newest = ours.reduce<string | null>(
    (a, r) => (a === null || r.week > a ? r.week : a),
    null,
  );
  if (newest === null) return [];
  return members
    .filter((m) => {
      const [now, before] = ours
        .filter((r) => r.uid === m.uid)
        .sort((a, b) => b.week.localeCompare(a.week));
      return (
        now?.week === newest &&
        before !== undefined &&
        before.points > 0 &&
        now.points >= before.points * (1 + IMPROVED_BY)
      );
    })
    .map((m) => m.name)
    .sort((a, b) => a.localeCompare(b));
}
