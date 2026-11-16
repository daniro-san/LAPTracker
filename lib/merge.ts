// The merge simulator's arithmetic (D84, #282). Pure: two rosters, a capacity and the other alliances'
// might in; the merged alliance's members, might and rank out. No IO, no names. A hypothetical, not a plan.
import { rankBy, sumPower } from "./compute";

/** The capacity /v1 reports today (D32); used only when neither alliance has a stored one. */
export const DEFAULT_CAPACITY = 100;

export interface MergeMember {
  uid: number;
  power: number | null;
}

export interface MergeSide {
  unionId: number;
  members: readonly MergeMember[];
}

export interface MergeResult {
  /** The cap the merged alliance is held to: the larger stored capacity of the two (D84). */
  capacity: number;
  /** Distinct members of both rosters; a member in both counts once. */
  members: number;
  /** Members in both rosters. */
  shared: number;
  /** Members who fit: the strongest by might, `capacity` of them at most. */
  within: number;
  /** `max(0, members − capacity)`: the members who would not fit. */
  leftOut: number;
  overCap: boolean;
  /** Might of every member / of the members within the cap / of the members left out. */
  mightAll: number;
  mightWithin: number;
  mightLeftOut: number;
  /** Place among the other tracked alliances, 1 = first; with every member and within the cap. */
  rankAll: number | null;
  rankWithin: number | null;
}

/** The capacity the merged alliance gets: the larger stored one; the default when neither is stored. */
export const mergedCapacity = (a: number | null, b: number | null): number =>
  Math.max(a ?? 0, b ?? 0) || DEFAULT_CAPACITY;

/**
 * Both rosters merged by uid (a member in both counts once, at the larger might, since the two readings
 * may differ in time), cut to `capacity` strongest by might (ties: lower uid first). A null might counts
 * as 0 (D15). `others` is the might of every other tracked alliance, from the same kind of read; the
 * merged alliance is placed among them by might, once with all members and once within the cap.
 */
export function simulateMerge(
  a: MergeSide,
  b: MergeSide,
  capacity: number,
  others: readonly { unionId: number; power: number | null }[],
): MergeResult {
  const byUid = new Map<number, number>();
  for (const m of [...a.members, ...b.members]) {
    byUid.set(m.uid, Math.max(byUid.get(m.uid) ?? 0, m.power ?? 0));
  }
  const shared = a.members.length + b.members.length - byUid.size;
  const sorted = [...byUid].sort(([uidP, p], [uidQ, q]) => q - p || uidP - uidQ);
  const within = sorted.slice(0, capacity);
  const mightAll = sumPower(sorted.map(([, power]) => ({ power })));
  const mightWithin = sumPower(within.map(([, power]) => ({ power })));
  const placeOf = (might: number) =>
    rankBy([...others.map((o) => [o.unionId, o.power] as const), [null, might] as const]).get(
      null,
    ) ?? null;
  return {
    capacity,
    members: byUid.size,
    shared,
    within: within.length,
    leftOut: Math.max(0, byUid.size - capacity),
    overCap: byUid.size > capacity,
    mightAll,
    mightWithin,
    mightLeftOut: mightAll - mightWithin,
    rankAll: placeOf(mightAll),
    rankWithin: placeOf(mightWithin),
  };
}
