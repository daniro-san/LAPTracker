// The roll call grid's rules (issue 412, rollout PR 5; D103 amended): who is "to mark", what each filter
// chip shows, and which members sit in the collapsed "Marked (n)" group. Each member has one counted mark,
// the roll call's own; on Raid prep that is the Shield (D137: the counts read the Shield only). Squads off
// the wall is optional and never makes anyone "to mark" (issue 585). The sections are taken when the page
// opens and each time a chip is tapped, never by a tap on a mark, so a tile never moves under the thumb
// (D103). Not set never counts (D75): it is only "to mark". A count that stands for people can show exactly
// them in the grid ("Show the 21 ›", a set with no chip pressed), and the marking page can open on a chip
// from its address (`?filter=`, the Roll call list's counts).
import type { Mark } from "@/lib/private/roll-call-rules";

export const GRID_FILTERS = ["todo", "yes", "no", "all"] as const;
export type GridFilter = (typeof GRID_FILTERS)[number];
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

/**
 * The chip the page opens on, from its address: `?filter=` names a chip, anything else is "To mark". ✗ is
 * never the default (D75): it opens only from a tap on a ✗ count.
 */
export const filterOf = (value: unknown): GridFilter =>
  GRID_FILTERS.find((f) => f === value) ?? "todo";

/**
 * The chip (null for a shown set, with its line, "The 21 to remind") and, per member, whether they were in
 * its list when it was taken.
 */
export interface GridSnap {
  filter: GridFilter | null;
  label?: string;
  inList: Map<number, boolean>;
}

export const takeSnap = (filter: GridFilter, uids: number[], markOf: MarkOf): GridSnap => ({
  filter,
  inList: new Map(uids.map((u) => [u, matches(filter, markOf(u))])),
});

/** Exactly the members of `set`, taken once like a chip's list: a mark meanwhile moves nobody (D103). */
export const takeSet = (uids: number[], set: readonly number[], label: string): GridSnap => {
  const shown = new Set(set);
  return { filter: null, label, inList: new Map(uids.map((u) => [u, shown.has(u)])) };
};

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
  // A member new since then is in a chip's list by their mark now, and never in a shown set.
  const inList = (r: T) =>
    snap.inList.get(r.uid) ?? (snap.filter !== null && matches(snap.filter, markOf(r.uid)));
  return {
    list: rows.filter(inList),
    marked: snap.filter === "todo" ? rows.filter((r) => !inList(r)) : [],
  };
}
