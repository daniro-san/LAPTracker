import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  blocFigures,
  blocQuery,
  concentration,
  greatestShareUp,
  parseBlocs,
  shares,
  tap,
  topShare,
  type BalanceAlliance,
} from "./balance";

const mights = fc.array(fc.integer({ min: 0, max: 10_000_000_000 }), {
  minLength: 1,
  maxLength: 30,
});

const alliance = (unionId: number, might: number, members = 10): BalanceAlliance => ({
  unionId,
  tag: `A${unionId}`,
  name: null,
  badgeId: null,
  might,
  members,
  at: new Date("2026-11-16T08:00:00Z"),
});

describe("shares", () => {
  it("sum to 1 whenever there is might, and are each between 0 and 1", () => {
    fc.assert(
      fc.property(mights, (ms) => {
        const s = shares(ms);
        if (ms.some((m) => m > 0)) expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
        else expect(s.every((x) => x === 0)).toBe(true);
        expect(s.every((x) => x >= 0 && x <= 1)).toBe(true);
      }),
    );
  });
});

describe("greatestShareUp", () => {
  it("rounds the greatest share up to a whole percent, and keeps an exact one", () => {
    // Greatest 87 of 1000 (8.7 %), and greatest 7 of 100 (exactly 7 %).
    const upTo9 = [...Array<number>(11).fill(87), 43];
    const exact7 = [...Array<number>(14).fill(7), 2];
    expect([greatestShareUp(upTo9), greatestShareUp(exact7), greatestShareUp([0, 0])]).toEqual([
      0.09, 0.07, 0,
    ]);
  });

  it("is never below the greatest share and never a whole point above it", () => {
    fc.assert(
      fc.property(mights, (ms) => {
        if (!ms.some((m) => m > 0)) return;
        const greatest = Math.max(...shares(ms));
        const up = greatestShareUp(ms);
        expect(up + 1e-12).toBeGreaterThanOrEqual(greatest);
        expect(up - greatest).toBeLessThan(0.01);
      }),
    );
  });
});

describe("topShare", () => {
  it("is the greatest three over the total", () => {
    expect(topShare([50, 30, 10, 5, 5])).toBeCloseTo(0.9, 9);
    expect(topShare([1, 1])).toBe(1);
    expect(topShare([0, 0])).toBe(0);
  });

  it("never falls under 3/n of the alliances and never passes 1", () => {
    fc.assert(
      fc.property(mights, (ms) => {
        const t = topShare(ms);
        expect(t).toBeLessThanOrEqual(1 + 1e-12);
        if (ms.some((m) => m > 0))
          expect(t + 1e-12).toBeGreaterThanOrEqual(Math.min(3 / ms.length, 1));
      }),
    );
  });
});

describe("blocFigures", () => {
  it("a bloc's share is the sum of its members' shares", () => {
    fc.assert(
      fc.property(mights, fc.array(fc.nat(29)), (ms, picks) => {
        const all = ms.map((m, i) => alliance(i + 1, m));
        const ids = [...new Set(picks.filter((p) => p < ms.length).map((p) => p + 1))];
        const s = shares(ms);
        const expected = ids.reduce((a, id) => a + (s[id - 1] ?? 0), 0);
        expect(blocFigures(all, ids).share).toBeCloseTo(expected, 9);
      }),
    );
  });

  it("totals the might and the members of the bloc only", () => {
    const all = [alliance(1, 600, 80), alliance(2, 300, 50), alliance(3, 100, 20)];
    expect(blocFigures(all, [2, 3])).toEqual({ n: 2, share: 0.4, might: 400, members: 70 });
    expect(blocFigures(all, [])).toEqual({ n: 0, share: 0, might: 0, members: 0 });
  });
});

describe("blocs in the URL", () => {
  const known = new Set([1, 2, 3, 4]);

  it("an alliance is in at most one bloc: when named twice, A keeps it", () => {
    expect(parseBlocs("1,2", "2,3", known)).toEqual({ a: [1, 2], b: [3] });
  });

  it("drops unknown, malformed and repeated ids", () => {
    expect(parseBlocs("1,1,x,99,2", undefined, known)).toEqual({ a: [1, 2], b: [] });
  });

  it("a tap moves an alliance to a bloc, a second tap removes it, and the URL round-trips", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(fc.integer({ min: 1, max: 4 }), fc.constantFrom("a", "b")), {
          maxLength: 12,
        }),
        (taps) => {
          let blocs = { a: [] as number[], b: [] as number[] };
          for (const [id, side] of taps) blocs = tap(blocs, id, side);
          expect(blocs.a.filter((id) => blocs.b.includes(id))).toEqual([]);
          const q = new URLSearchParams(blocQuery(blocs));
          expect(parseBlocs(q.get("a") ?? undefined, q.get("b") ?? undefined, known)).toEqual(
            blocs,
          );
        },
      ),
    );
    expect(tap({ a: [1], b: [] }, 1, "a")).toEqual({ a: [], b: [] });
    expect(tap({ a: [1], b: [] }, 1, "b")).toEqual({ a: [], b: [1] });
  });

  it("empty blocs give an empty query", () => {
    expect(blocQuery({ a: [], b: [] })).toBe("");
  });
});

describe("concentration", () => {
  const row = (day: string, unionId: number, might: number) => ({
    day,
    unionId,
    might,
    at: new Date(`${day}T08:00:00Z`),
  });

  it("is the top share per day, oldest first, and skips a day with fewer alliances than the server", () => {
    const rows = [
      row("2026-11-16", 1, 50),
      row("2026-11-16", 2, 30),
      row("2026-11-16", 3, 10),
      row("2026-11-16", 4, 10),
      row("2026-11-15", 1, 50),
      row("2026-11-15", 2, 50),
      row("2026-11-14", 1, 25),
      row("2026-11-14", 2, 25),
      row("2026-11-14", 3, 25),
      row("2026-11-14", 4, 25),
    ];
    const points = concentration(rows, 4);
    expect(points.map((p) => p.day)).toEqual(["2026-11-14", "2026-11-16"]);
    expect(points.map((p) => p.top)).toEqual([0.75, 0.9]);
    expect(points[1]?.total).toBe(100);
  });
});
