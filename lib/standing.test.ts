import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { growthPercent, rankByMight, standing, type StandingInput } from "./standing";

const read = (day: string, unionId: number, might: number): StandingInput => ({
  day,
  unionId,
  tag: `A${unionId}`,
  name: null,
  badgeId: null,
  might,
});

const mights = fc.array(fc.integer({ min: 0, max: 10_000_000_000 }), {
  minLength: 1,
  maxLength: 30,
});

describe("rankByMight", () => {
  it("gives a permutation of 1..n, greatest might first, whatever the ties", () => {
    fc.assert(
      fc.property(mights, (ms) => {
        const ranks = rankByMight(ms.map((might, i) => ({ unionId: i + 1, might })));
        expect([...ranks.values()].sort((a, b) => a - b)).toEqual(ms.map((_, i) => i + 1));
        for (const [a, ra] of ranks)
          for (const [b, rb] of ranks)
            if (ra < rb) expect(ms[a - 1]).toBeGreaterThanOrEqual(ms[b - 1] ?? 0);
      }),
    );
  });
});

describe("standing", () => {
  const rows = [
    // 9 Nov: A1 40, A2 30, A3 20. 12 Nov: A3 passes A2. 16 Nov: the same.
    ...[read("2026-11-09", 1, 40), read("2026-11-09", 2, 30), read("2026-11-09", 3, 20)],
    ...[read("2026-11-12", 1, 40), read("2026-11-12", 2, 30), read("2026-11-12", 3, 35)],
    ...[read("2026-11-16", 1, 44), read("2026-11-16", 2, 30), read("2026-11-16", 3, 40)],
  ];

  it("ranks the newest day, says how far each alliance moved and how much its might grew", () => {
    const s = standing(rows);
    expect(s?.days).toEqual(["2026-11-09", "2026-11-12", "2026-11-16"]);
    expect(s?.rows.map((r) => [r.unionId, r.rank, r.move, r.ranks])).toEqual([
      [1, 1, 0, [1, 1, 1]],
      [3, 2, 1, [3, 2, 2]],
      [2, 3, -1, [2, 3, 3]],
    ]);
    expect(s?.rows.map((r) => r.growth)).toEqual([10, 100, 0]);
    expect(s?.serverGrowth).toBeCloseTo((114 / 90 - 1) * 100, 9);
    expect(s?.serverMight).toBe(114);
  });

  it("leaves out a day on which a listed alliance has no usable roster", () => {
    // A3 has no usable read on the 12th (stale or failed rows are not in the input).
    const gap = rows.filter((r) => !(r.day === "2026-11-12" && r.unionId === 3));
    expect(standing(gap)?.days).toEqual(["2026-11-09", "2026-11-16"]);
  });

  it("looks back 7 days from the newest complete day", () => {
    const older = [read("2026-11-01", 1, 10), read("2026-11-01", 2, 10), ...rows];
    expect(standing(older)?.days[0]).toBe("2026-11-09");
  });

  it("takes the 7 days to the newest read: an alliance with no read in it is named, one with a gap day drops that day", () => {
    const dead = [read("2026-11-01", 4, 99), read("2026-11-02", 4, 99), ...rows];
    const s = standing(dead.filter((r) => !(r.day === "2026-11-12" && r.unionId === 3)));
    expect(s?.days).toEqual(["2026-11-09", "2026-11-16"]);
    expect(s?.rows.map((r) => r.unionId)).toEqual([1, 3, 2]);
    expect(s?.notRanked.map((a) => a.unionId)).toEqual([4]);
    expect(s?.serverMight).toBe(114);
  });

  it("is null with fewer than two days to compare", () => {
    expect(standing(rows.filter((r) => r.day === "2026-11-16"))).toBeNull();
    expect(standing([])).toBeNull();
  });

  it("the server's growth lies between the least and the greatest alliance growth", () => {
    const positive = fc.array(
      fc.tuple(fc.integer({ min: 1, max: 1e9 }), fc.integer({ min: 0, max: 1e9 })),
      {
        minLength: 1,
        maxLength: 20,
      },
    );
    fc.assert(
      fc.property(positive, (pairs) => {
        const input = pairs.flatMap(([start, end], i) => [
          read("2026-11-09", i + 1, start),
          read("2026-11-16", i + 1, end),
        ]);
        const s = standing(input);
        const growths = (s?.rows ?? []).flatMap((r) => (r.growth === null ? [] : [r.growth]));
        expect(s?.serverGrowth).toBeGreaterThanOrEqual(Math.min(...growths) - 1e-6);
        expect(s?.serverGrowth).toBeLessThanOrEqual(Math.max(...growths) + 1e-6);
      }),
    );
  });
});

describe("growthPercent", () => {
  it("is null from a start of 0", () => {
    expect(growthPercent(0, 5)).toBeNull();
    expect(growthPercent(200, 206)).toBe(3);
  });
});
