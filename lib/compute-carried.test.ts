import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { carriedShares, ratioSpread } from "./compute";

const count = fc.option(fc.nat({ max: 2_000_000_000 }), { nil: null });

describe("carriedShares (#280)", () => {
  const input = fc.array(fc.record({ might: count, gained: count }), {
    maxLength: 12,
  });

  it("splits the might and the kills gained in shares that each add up to 1", () => {
    fc.assert(
      fc.property(input, (rows) => {
        const shares = carriedShares(rows.map((r, key) => ({ key, ...r })));
        if (shares.length === 0) return;
        const sum = (pick: (s: (typeof shares)[number]) => number) =>
          shares.reduce((t, s) => t + pick(s), 0);
        expect(sum((s) => s.mightShare)).toBeCloseTo(1, 9);
        expect(sum((s) => s.killShare)).toBeCloseTo(1, 9);
      }),
    );
  });

  it("divides the kill share by the might share and leaves out an alliance with a null total", () => {
    const shares = carriedShares([
      { key: 1, might: 100, gained: 300 },
      { key: 2, might: 300, gained: 100 },
      { key: 3, might: null, gained: 999 },
    ]);
    expect(shares.map((s) => s.key)).toEqual([1, 2]);
    expect(shares[0]).toMatchObject({ mightShare: 0.25, killShare: 0.75, ratio: 3 });
  });

  it("counts a fall in an alliance's kills as no gain", () => {
    const shares = carriedShares([
      { key: 1, might: 1, gained: -40 },
      { key: 2, might: 1, gained: 10 },
    ]);
    expect(shares.map((s) => s.killShare)).toEqual([0, 1]);
  });
});

describe("ratioSpread (#280)", () => {
  it("gives no spread under 3 ratios, and the lowest and highest from 3", () => {
    expect(ratioSpread([2, 3])).toBeNull();
    expect(ratioSpread([2.5, 1.8, 2.9])).toEqual({ n: 3, low: 1.8, high: 2.9 });
  });
});
