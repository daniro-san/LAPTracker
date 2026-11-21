// The roll call grid's rules (issue 412, rollout PR 5; D103 amended): who is "to mark", what each filter
// chip shows, and which members sit in the collapsed "Marked (n)" group. Each member has one counted mark,
// the roll call's own; on Raid prep that is the Shield (D137: the counts read the Shield only). Squads off
// the wall is optional and never makes anyone "to mark" (issue 585). The sections are taken when the page
// opens and each time a chip is tapped, never by a tap on a mark, so a tile never moves under the thumb
// (D103). Not set never counts (D75): it is only "to mark".
import type { Mark } from "@/lib/private/roll-call-rules";

export type GridFilter = "todo" | "yes" | "no" | "all";
/** A member's counted mark, live. */
export type MarkOf = (uid: number) => Mark | null;

/** How many marked members the open "Marked" group shows at a time ("Show 40 more"). */
export const MARKED_PAGE = 40;

/** To mark: nobody marked it yet. ✓: ✓ or "no problem seen". ✗: ✗. */
export function matches(filter: GridFilter, mark: Mark | null): boolean {
  if (filter === "all") return true;
  if (filter === "todo") return mark === null;
  if (filter === "no") return mark === "no";
  return mark === "yes" || mark === "assumed";
}

/** Each chip's count, live. */
export const gridCounts = (uids: number[], markOf: MarkOf) =>
  Object.fromEntries(
    (["todo", "yes", "no", "all"] as const).map((f) => [
      f,
      uids.filter((u) => matches(f, markOf(u))).length,
    ]),
  ) as Record<GridFilter, number>;

/** The chip and, per member, whether they were in its list when it was taken. */
export interface GridSnap {
  filter: GridFilter;
  inList: Map<number, boolean>;
}

export const takeSnap = (filter: GridFilter, uids: number[], markOf: MarkOf): GridSnap => ({
  filter,
  inList: new Map(uids.map((u) => [u, matches(filter, markOf(u))])),
});

/**
 * The tiles to show and, under "To mark", the collapsed group of those marked when it was taken. A member
 * new since then is placed by their mark now. A search looks through every member, whatever is collapsed.
 */
export function sections<T extends { uid: number }>(
  rows: T[],
  snap: GridSnap,
  markOf: MarkOf,
  found: ((row: T) => boolean) | null,
): { list: T[]; marked: T[] } {
  if (found) return { list: rows.filter(found), marked: [] };
  const inList = (r: T) => snap.inList.get(r.uid) ?? matches(snap.filter, markOf(r.uid));
  return {
    list: rows.filter(inList),
    marked: snap.filter === "todo" ? rows.filter((r) => !inList(r)) : [],
  };
}
