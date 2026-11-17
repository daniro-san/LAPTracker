import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  activityOrder,
  buildFlow,
  FLOW_MIN,
  placeMembers,
  summarise,
  visibleCells,
  type FlowCell,
} from "./flow";

const place = (entries: [number, number][]) => new Map(entries);
const n = (cells: FlowCell[], from: number | null, to: number | null) =>
  cells.find((c) => c.from === from && c.to === to)?.n ?? 0;

describe("placeMembers", () => {
  it("places a uid in two rosters of one day with the roster read later, the lower union id on a tie", () => {
    const placed = placeMembers([
      { unionId: 1, at: 10, uids: [100, 101] },
      { unionId: 2, at: 20, uids: [100] },
      { unionId: 4, at: 30, uids: [102] },
      { unionId: 3, at: 30, uids: [102] },
    ]);
    expect([placed.get(100), placed.get(101), placed.get(102)]).toEqual([2, 1, 3]);
  });
});

describe("buildFlow", () => {
  it("counts moves, stays, members new to the counted alliances and members who left them", () => {
    const start = place([
      [1, 10], // stays
      [2, 10], // moves to 20
      [3, 10], // leaves for an alliance that is not counted
      [4, 99], // not counted on the start day
    ]);
    const end = place([
      [1, 10],
      [2, 20],
      [3, 99],
      [4, 20], // new to the counted alliances
      [5, 10], // new to the counted alliances
      [6, 99], // outside on the end day, absent on the start day
    ]);
    const cells = buildFlow(start, end, [10, 20]);
    expect([n(cells, 10, 10), n(cells, 10, 20), n(cells, 10, null)]).toEqual([1, 1, 1]);
    expect([n(cells, null, 20), n(cells, null, 10)]).toEqual([1, 1]);
    expect(cells.reduce((s, c) => s + c.n, 0)).toBe(5);
  });

  it("holds for any placements: a row adds up to its alliance's start members, a column to its end members", () => {
    const placement = fc
      .dictionary(fc.integer({ min: 1, max: 80 }).map(String), fc.integer({ min: 1, max: 6 }))
      .map((p) => new Map(Object.entries(p).map(([uid, id]) => [Number(uid), id])));
    fc.assert(
      fc.property(placement, placement, (start, end) => {
        const ids = [1, 2, 3, 4];
        const cells = buildFlow(start, end, ids);
        for (const id of ids) {
          const startSize = [...start.values()].filter((u) => u === id).length;
          const endSize = [...end.values()].filter((u) => u === id).length;
          expect(cells.filter((c) => c.from === id).reduce((s, c) => s + c.n, 0)).toBe(startSize);
          expect(cells.filter((c) => c.to === id).reduce((s, c) => s + c.n, 0)).toBe(endSize);
        }
      }),
    );
  });
});

describe("visibleCells", () => {
  it("drops every cell under the threshold and keeps the rest", () => {
    const cells: FlowCell[] = [
      { from: 1, to: 2, n: FLOW_MIN - 1 },
      { from: 1, to: 3, n: FLOW_MIN },
    ];
    expect(visibleCells(cells)).toEqual([{ from: 1, to: 3, n: FLOW_MIN }]);
  });

  it("holds for any cells: every cell left is at least the threshold, none that qualified is lost", () => {
    const cell = fc.record({
      from: fc.option(fc.integer({ min: 1, max: 5 })),
      to: fc.option(fc.integer({ min: 1, max: 5 })),
      n: fc.integer({ min: 1, max: 40 }),
    });
    fc.assert(
      fc.property(fc.array(cell, { maxLength: 30 }), (cells) => {
        const shown = visibleCells(cells);
        expect(shown.every((c) => c.n >= FLOW_MIN)).toBe(true);
        expect(shown.length).toBe(cells.filter((c) => c.n >= FLOW_MIN).length);
      }),
    );
  });
});

describe("summarise", () => {
  it("counts moves, arrivals and departures, and names the largest move that is big enough to show", () => {
    const s = summarise([
      { from: 1, to: 1, n: 50 },
      { from: 1, to: 2, n: 24 },
      { from: 1, to: 3, n: 8 },
      { from: 3, to: 2, n: 4 },
      { from: 1, to: null, n: 6 },
      { from: null, to: 2, n: 30 },
    ]);
    expect([s.moved, s.arrived, s.left]).toEqual([36, 30, 6]);
    expect(s.largest).toEqual({ from: 1, to: 2, n: 24 });
  });

  it("has no largest move when every move is under the threshold", () => {
    expect(summarise([{ from: 1, to: 2, n: FLOW_MIN - 1 }]).largest).toBeNull();
  });
});

describe("activityOrder", () => {
  it("puts the alliances with the most moves in or out first and ignores members who stayed", () => {
    const cells: FlowCell[] = [
      { from: 3, to: 3, n: 90 },
      { from: 1, to: 2, n: 10 },
      { from: null, to: 2, n: 5 },
    ];
    expect(activityOrder(cells, [1, 2, 3])).toEqual([2, 1, 3]);
  });
});
