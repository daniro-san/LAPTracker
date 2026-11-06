import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  delta,
  type Measured,
  nameHistory,
  rankBy,
  rankDelta,
  rosterDiff,
  type SeriesRow,
  seriesDeltas,
  sumKills,
  sumPower,
  topMovers,
} from "./compute";

const count = fc.option(fc.nat({ max: 2_000_000_000 }), { nil: null });
const memberValues = fc.record({
  name: fc.constantFrom("Ann", "Bo", "Cy"),
  power: count,
  kills: count,
});

/** Each uid may be in the before roster, the after roster, or both, with independent values. */
const rosterPair = fc
  .uniqueArray(
    fc.record({
      uid: fc.nat({ max: 10_000 }),
      before: fc.option(memberValues, { nil: null }),
      after: fc.option(memberValues, { nil: null }),
    }),
    { selector: (m) => m.uid, maxLength: 100 },
  )
  .map((pool) => ({
    before: pool.flatMap((m) => (m.before ? [{ uid: m.uid, ...m.before }] : [])),
    after: pool.flatMap((m) => (m.after ? [{ uid: m.uid, ...m.after }] : [])),
  }));

const measured: fc.Arbitrary<Measured> = fc.record({
  isFresh: fc.boolean(),
  totalPower: count,
  totalKills: count,
});

describe("sumKills", () => {
  it("equals the sum of the members' kills, nulls as 0, for any roster", () => {
    fc.assert(
      fc.property(fc.array(fc.record({ kills: count }), { maxLength: 100 }), (members) => {
        let expected = 0;
        for (const m of members) if (m.kills !== null) expected += m.kills;
        expect(sumKills(members)).toBe(expected);
      }),
    );
  });
});

describe("delta", () => {
  it("of alliance totals equals the sum of member deltas plus joined minus left", () => {
    fc.assert(
      fc.property(rosterPair, ({ before, after }) => {
        const side = (members: typeof before): Measured => ({
          isFresh: true,
          totalPower: sumPower(members),
          totalKills: sumKills(members),
        });
        const { joined, left, stayed } = rosterDiff(before, after);
        const k = (m: { kills: number | null }) => m.kills ?? 0;
        const p = (m: { power: number | null }) => m.power ?? 0;
        const total = (f: (m: (typeof before)[number]) => number) =>
          stayed.reduce((t, s) => t + f(s.after) - f(s.before), 0) +
          joined.reduce((t, m) => t + f(m), 0) -
          left.reduce((t, m) => t + f(m), 0);

        expect(delta(side(before), side(after))).toEqual({ power: total(p), kills: total(k) });
      }),
    );
  });

  it("is null whenever either side is stale", () => {
    fc.assert(
      fc.property(measured, measured, (before, after) => {
        fc.pre(!before.isFresh || !after.isFresh);
        expect(delta(before, after)).toBeNull();
      }),
    );
  });
});

describe("nameHistory", () => {
  it("never drops a pair and keeps first-seen order", () => {
    const sighting = fc.record({
      tag: fc.constantFrom("WOL", "URSA"),
      name: fc.constantFrom("Wolves", "Ursus Invictus"),
      at: fc.date({
        min: new Date("2026-01-01"),
        max: new Date("2027-01-01"),
        noInvalidDate: true,
      }),
    });
    fc.assert(
      fc.property(fc.array(sighting, { maxLength: 30 }), (rows) => {
        const history = nameHistory(rows);
        const key = (r: { tag: string; name: string }) => `${r.tag}\u0000${r.name}`;

        expect(history.map(key).sort()).toEqual([...new Set(rows.map(key))].sort());
        for (const entry of history) {
          const times = rows.filter((r) => key(r) === key(entry)).map((r) => r.at.getTime());
          expect(entry.firstSeen.getTime()).toBe(Math.min(...times));
          expect(entry.lastSeen.getTime()).toBe(Math.max(...times));
        }
        const firsts = history.map((e) => e.firstSeen.getTime());
        expect(firsts).toEqual([...firsts].sort((a, b) => a - b));
      }),
    );
  });
});

type Field = "power" | "kills" | "lv";

describe("seriesDeltas", () => {
  it("sums consecutive deltas to last − first when no row is stale", () => {
    const freshRow: fc.Arbitrary<SeriesRow> = fc.record({
      isFresh: fc.constant(true),
      power: fc.nat({ max: 5_000_000_000 }),
      kills: fc.nat({ max: 100_000_000 }),
      lv: fc.nat({ max: 50 }),
      name: fc.constantFrom("OldGrandmas", "OGs"),
      tag: fc.constantFrom("OGs", "OG"),
      unionId: fc.constantFrom(67111155, 67110320),
    });
    fc.assert(
      fc.property(fc.array(freshRow, { minLength: 1, maxLength: 26 }), (rows) => {
        const steps = seriesDeltas(rows).slice(1);
        const value = (i: number, f: Field) => rows.at(i)?.[f] ?? NaN;
        for (const f of ["power", "kills", "lv"] as const) {
          const sum = steps.reduce((t, s) => t + (s[f] ?? NaN), 0);
          expect(sum).toBe(value(-1, f) - value(0, f));
        }
      }),
    );
  });
});

describe("rankBy", () => {
  it("ranks highest first, shares a rank on ties and leaves missing values unranked", () => {
    const ranks = rankBy([
      ["a", 10],
      ["b", 30],
      ["c", 10],
      ["d", null],
      ["e", 5],
    ]);
    expect([...ranks].sort()).toEqual([
      ["a", 2],
      ["b", 1],
      ["c", 2],
      ["e", 4],
    ]);
  });
});

describe("rankDelta", () => {
  it("counts places moved up as positive, down as negative, and is null without both ranks", () => {
    expect(rankDelta(3, 1)).toBe(2);
    expect(rankDelta(1, 4)).toBe(-3);
    expect(rankDelta(2, 2)).toBe(0);
    expect(rankDelta(null, 1)).toBeNull();
    expect(rankDelta(1, undefined)).toBeNull();
  });
});

describe("topMovers", () => {
  const side = (power: number | null, kills: number | null, isFresh = true): Measured => ({
    isFresh,
    totalPower: power,
    totalKills: kills,
  });
  const row = (id: string, before: Measured | null, after: Measured | null) => ({
    id,
    before,
    after,
  });
  const rows = [
    row("a", side(100, 10), side(150, 12)), // +50 power, +2 kills
    row("b", side(200, 20), side(170, 20)), // −30
    row("c", side(100, 5), side(150, 9)), // +50, tied with a
    row("d", side(300, 1), side(310, 1)), // +10
    row("e", side(100, 1), side(100, 1)), // no change
  ];
  const ids = (list: { row: { id: string } }[]) => list.map((m) => m.row.id);

  it("ranks gains highest first; ties keep input order and share a rank", () => {
    const top = topMovers(rows, "power", 3, "gain");
    expect(ids(top)).toEqual(["a", "c", "d"]);
    expect(top.map((m) => m.rank)).toEqual([1, 1, 3]);
    expect(top[0]).toMatchObject({ delta: 50, base: 100 });
  });

  it("ranks losses most negative first and leaves out gains and zero changes", () => {
    expect(topMovers(rows, "power", 5, "loss").map((m) => [m.row.id, m.delta])).toEqual([
      ["b", -30],
    ]);
  });

  it("ranks the metric asked for", () => {
    expect(ids(topMovers(rows, "kills", 5, "gain"))).toEqual(["c", "a"]);
  });

  it("returns every mover when n is larger than the rows", () => {
    expect(topMovers(rows, "power", 50, "gain")).toHaveLength(3);
  });

  it("leaves out a row with a missing, stale or null side", () => {
    const bad = [
      row("missing", null, side(900, 9)),
      row("stale", side(1, 1, false), side(900, 9)),
      row("null", side(null, null), side(900, 9)),
    ];
    expect(topMovers([...bad, ...rows], "power", 5, "gain").map((m) => m.row.id)).toEqual([
      "a",
      "c",
      "d",
    ]);
  });
});
