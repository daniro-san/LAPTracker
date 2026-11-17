import { describe, expect, it } from "vitest";

import { sameName, searchRoster, SEARCH_ROWS } from "./roster-search";

// Names as the OGs fixture spells them: an accent, a joined name, a trailing Hangul filler.
const ROSTER = [
  { uid: 1, name: "Vińs" },
  { uid: 2, name: "LadyLi-rosan" },
  { uid: 3, name: "Trizㅤ" },
  ...Array.from({ length: 10 }, (_, i) => ({ uid: 100 + i, name: `Player ${i}` })),
];
const uids = (query: string) => searchRoster(query, ROSTER).map((p) => p.uid);

describe('the "This is me" search (issue 334)', () => {
  it("finds members by part of the name, whatever the case, accents and decoration, a few at a time", () => {
    expect(uids("vins")).toEqual([1]);
    expect(uids("LADYLI")).toEqual([2]);
    expect(uids("triz")).toEqual([3]);
    expect(uids("  ")).toEqual([]);
    expect(uids("player")).toHaveLength(SEARCH_ROWS);
  });
});

describe("a new member's name that is already a member's (D106, 2026-11-17)", () => {
  it("finds every current member with the same name key, and none for another name", () => {
    const roster = [
      { uid: 11, name: "Zéphyrine" },
      { uid: 12, name: "Corvin" },
      { uid: 13, name: "★CORVIN★" },
    ];
    expect(sameName("zephyrine", roster).map((m) => m.uid)).toEqual([11]);
    expect(sameName(" corvin ", roster).map((m) => m.uid)).toEqual([12, 13]);
    expect(sameName("Corvina", roster)).toEqual([]);
    expect(sameName("★★", roster)).toEqual([]);
  });
});
