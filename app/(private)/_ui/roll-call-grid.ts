// The roll call grid's rules (issue 412, rollout PR 5; D103 amended): who is "to mark", what each filter
// chip shows, and which members sit in the collapsed "Marked (n)" group. A member's marks are one part, or
// Raid prep's two (Shield and Squads off the wall, D137). The sections are taken when the page opens and
// each time a chip is tapped, never by a tap on a mark, so a tile never moves under the thumb (D103).
// Not set never counts (D75): it is only "to mark".
import type { Mark } from "@/lib/private/roll-call-rules";

export type GridFilter = "todo" | "yes" | "no" | "all";
export type Parts = (Mark | null)[];

/** How many marked members the open "Marked" group shows at a time ("Show 40 more"). */
export const MARKED_PAGE = 40;

/** To mark: a part nobody marked yet. ✓: every part ✓ or "no problem seen". ✗: any part ✗. */
export function matches(filter: GridFilter, parts: Parts): boolean {
  if (filter === "all") return true;
  const todo = parts.some((p) => p === null);
  if (filter === "todo") return todo;
  if (filter === "no") return parts.includes("no");
  return !todo && parts.every((p) => p === "yes" || p === "assumed");
}

/** Each chip's count, live. */
export const gridCounts = (uids: number[], partsOf: (uid: number) => Parts) =>
  Object.fromEntries(
    (["todo", "yes", "no", "all"] as const).map((f) => [
      f,
      uids.filter((u) => matches(f, partsOf(u))).length,
    ]),
  ) as Record<GridFilter, number>;

/** The chip and, per member, whether they were in its list when it was taken. */
export interface GridSnap {
  filter: GridFilter;
  inList: Map<number, boolean>;
}

export const takeSnap = (
  filter: GridFilter,
  uids: number[],
  partsOf: (uid: number) => Parts,
): GridSnap => ({
  filter,
  inList: new Map(uids.map((u) => [u, matches(filter, partsOf(u))])),
});

/**
 * The tiles to show and, under "To mark", the collapsed group of those marked when it was taken. A member
 * new since then is placed by their marks now. A search looks through every member, whatever is collapsed.
 */
export function sections<T extends { uid: number }>(
  rows: T[],
  snap: GridSnap,
  partsOf: (uid: number) => Parts,
  found: ((row: T) => boolean) | null,
): { list: T[]; marked: T[] } {
  if (found) return { list: rows.filter(found), marked: [] };
  const inList = (r: T) => snap.inList.get(r.uid) ?? matches(snap.filter, partsOf(r.uid));
  return {
    list: rows.filter(inList),
    marked: snap.filter === "todo" ? rows.filter((r) => !inList(r)) : [],
  };
}
