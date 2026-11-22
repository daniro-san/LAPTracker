// The matchup's pure rules (D152): equal sets on both sides, fixed at the Start, and Start to End over the
// members in both readings. Invented alliances and members.
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { heavyCount, matchupOf, memberChange, type SideAlliance } from "./kvk";

const AT = new Date("2026-11-28T12:03:00Z"); // Sat 10:03 ST
const alliance = (unionId: number, might: number, extra: Partial<SideAlliance> = {}) =>
  ({
    unionId,
    tag: `A${unionId}`,
    name: null,
    might,
    kills: might / 100,
    members: 90,
    heavy: 10,
    readAt: AT,
    change: null,
    ...extra,
  }) satisfies SideAlliance;

describe("matchupOf (D152)", () => {
  it("compares the same number of alliances on both sides: the smaller count of usable Start readings", () => {
    fc.assert(
      fc.property(fc.nat({ max: 20 }), fc.nat({ max: 15 }), (a, b) => {
        const ours = Array.from({ length: a }, (_, i) => alliance(i + 1, (i + 1) * 1e8));
        const theirs = Array.from({ length: b }, (_, i) => alliance(100 + i, (i + 1) * 1e8));
        const m = matchupOf(ours, theirs, false);
        if (Math.min(a, b) === 0) expect(m).toBeNull();
        else {
          expect(m?.us.alliances).toHaveLength(Math.min(a, b));
          expect(m?.them.alliances).toHaveLength(Math.min(a, b));
        }
      }),
    );
  });

  it("keeps each side's top n by Start might, and kills per 1B might is the sum over the sum", () => {
    const ours = [
      alliance(1, 4e9, { kills: 60e6 }),
      alliance(2, 1e9, { kills: 1e6 }),
      alliance(3, 3e9, { kills: 30e6 }),
    ];
    const theirs = [alliance(7, 4e9, { kills: 90e6 }), alliance(8, 2e9, { kills: 60e6 })];
    const m = matchupOf(ours, theirs, false);
    expect(m?.us.alliances.map((a) => a.unionId)).toEqual([1, 3]);
    expect(m?.us).toMatchObject({ might: 7e9, kills: 90e6, killsPer1B: (90e6 / 7e9) * 1e9 });
    expect(m?.them.killsPer1B).toBe(25e6);
  });

  it("counts Start to End only over the n chosen at the Start, and says how many had a usable End", () => {
    const change = { might: -300e6, kills: 4e6, members: 80 };
    const ours = [alliance(1, 4e9, { change }), alliance(2, 3e9), alliance(3, 1e9, { change })];
    const theirs = [alliance(7, 4e9, { change }), alliance(8, 2e9, { change })];
    const m = matchupOf(ours, theirs, true);
    // Alliance 3 is outside our top 2, so its End is not counted; alliance 2's End is not usable.
    expect(m?.us.change).toEqual({ counted: 1, might: -300e6, kills: 4e6, members: 80 });
    expect(m?.them.change).toEqual({ counted: 2, might: -600e6, kills: 8e6, members: 160 });
    expect(matchupOf(ours, theirs, false)?.us.change).toBeNull();
  });
});

describe("memberChange (D152)", () => {
  it("counts only the members in both readings, so a joiner or a leaver moves nothing", () => {
    const start = { uids: [1, 2, 3], might: [100, 200, 300], kills: [10, 20, 30] };
    // 3 left with 300 might; 4 joined with 600M.
    const end = { uids: [1, 2, 4], might: [90, 150, 600_000_000], kills: [15, 20, 5_000] };
    expect(memberChange(start, end)).toEqual({ might: -60, kills: 5, members: 2 });
  });

  it("leaves a member's null figure out of that figure, and counts a fall in kills as none", () => {
    const start = { uids: [1, 2], might: [null, 200], kills: [10, 50] };
    const end = { uids: [1, 2], might: [5_000_000_000, 180], kills: [12, 40] };
    expect(memberChange(start, end)).toEqual({ might: -20, kills: 2, members: 2 });
  });

  it("counts members with a known might of 60M or more as heavy", () => {
    expect(heavyCount([59_999_999, 60_000_000, null, 90_000_000])).toBe(2);
  });
});
