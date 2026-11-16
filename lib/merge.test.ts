import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { DEFAULT_CAPACITY, mergedCapacity, simulateMerge, type MergeMember } from "./merge";

const roster = (powers: number[], from = 1): MergeMember[] =>
  powers.map((power, i) => ({ uid: from + i, power }));
const side = (unionId: number, members: MergeMember[]) => ({ unionId, members });

describe("simulateMerge", () => {
  it("keeps the strongest members within the cap and counts the rest as left out", () => {
    const r = simulateMerge(side(1, roster([50, 10])), side(2, roster([40, 30], 3)), 3, []);
    expect([r.members, r.within, r.leftOut, r.overCap]).toEqual([4, 3, 1, true]);
    expect([r.mightAll, r.mightWithin, r.mightLeftOut]).toEqual([130, 120, 10]);
  });

  it("counts a member in both rosters once, at the larger might", () => {
    const r = simulateMerge(side(1, roster([10, 20])), side(2, roster([25, 5], 2)), 100, []);
    expect([r.members, r.shared, r.mightAll]).toEqual([3, 1, 10 + 25 + 5]);
  });

  it("places the merged alliance among the others, with everyone and within the cap", () => {
    const others = [
      { unionId: 3, power: 125 },
      { unionId: 4, power: 100 },
      { unionId: 5, power: null },
    ];
    const r = simulateMerge(side(1, roster([50, 10])), side(2, roster([40, 30], 3)), 3, others);
    expect([r.rankAll, r.rankWithin]).toEqual([1, 2]);
  });

  it("holds for any rosters: within-cap might never exceeds the total, left out = max(0, total - cap)", () => {
    const members = fc.array(
      fc.record({ uid: fc.integer({ min: 1, max: 60 }), power: fc.option(fc.nat(1e9)) }),
      { maxLength: 70 },
    );
    fc.assert(
      fc.property(members, members, fc.integer({ min: 1, max: 110 }), (x, y, cap) => {
        const r = simulateMerge(side(1, x), side(2, y), cap, []);
        expect(r.mightWithin).toBeLessThanOrEqual(r.mightAll);
        expect(r.leftOut).toBe(Math.max(0, r.members - cap));
        expect(r.within + r.leftOut).toBe(r.members);
        expect(r.mightLeftOut).toBe(r.mightAll - r.mightWithin);
        expect(r.overCap).toBe(r.leftOut > 0);
      }),
    );
  });
});

describe("mergedCapacity", () => {
  it("takes the larger stored capacity, else the default", () => {
    expect(mergedCapacity(100, 108)).toBe(108);
    expect(mergedCapacity(null, 101)).toBe(101);
    expect(mergedCapacity(null, null)).toBe(DEFAULT_CAPACITY);
  });
});
