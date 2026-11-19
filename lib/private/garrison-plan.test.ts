// The garrison plan's rules (issue 423, D121): who needs help and who is close against the enemy might T,
// what a helper can lend, the suggested pairs, and the order when there are more members than squads.
import { describe, expect, it } from "vitest";

import {
  helpOrder,
  needOf,
  pairsOk,
  sparesOf,
  suggestPairs,
  type PlanMember,
  type Signals,
} from "./garrison-plan";

const T = 8_000_000;
const NONE: Signals = { active: null, growing: null, tookPart: null };
const member = (uid: number, powers: number[], signals: Signals = NONE): PlanMember => ({
  uid,
  name: `M${uid}`,
  squads: powers.map((power, i) => ({ squad: i + 1, power })),
  signals,
});

describe("the garrison plan", () => {
  it("sorts members by their strongest squad against T, T + 1M still close", () => {
    expect(needOf([], T)).toBe("unknown");
    expect(needOf([{ squad: 1, power: 7_999_999 }], T)).toBe("help");
    expect(needOf([{ squad: 2, power: T }], T)).toBe("close");
    expect(needOf([{ squad: 1, power: 8_500_000 }], T)).toBe("close");
    expect(needOf([{ squad: 1, power: 9_000_000 }], T)).toBe("close");
    expect(needOf([{ squad: 1, power: 9_000_001 }], T)).toBe("fine");
  });

  it("keeps a helper's strongest squad home and lends the rest, strongest first", () => {
    // Squad 3 is the strongest: it stays home. Capacity = 4 squads − 1.
    expect(sparesOf(member(1, [9e6, 3e6, 15e6, 10e6]), T)).toEqual([
      { helper: 1, squad: 4, power: 10e6 },
      { helper: 1, squad: 1, power: 9e6 },
      { helper: 1, squad: 2, power: 3e6 },
    ]);
    // No squad at T: nothing to lend, however many squads.
    expect(sparesOf(member(2, [7e6, 6e6, 5e6]), T)).toEqual([]);
    expect(sparesOf(member(3, [12e6]), T)).toEqual([]);
  });

  it("gives each member one squad and lends each squad once", () => {
    const members = [member(1, [20e6, 12e6, 11e6]), member(2, [5e6]), member(3, [6e6])];
    const pairs = suggestPairs(members, T);
    expect(pairs).toEqual([
      { helper: 1, squad: 2, member: 2 },
      { helper: 1, squad: 3, member: 3 },
    ]);
    expect(pairsOk(pairs, members)).toBe(true);
    // Two squads to one member, one squad twice, or the helper's strongest squad: refused.
    expect(pairsOk([...pairs, { helper: 1, squad: 3, member: 2 }], members)).toBe(false);
    const lent = { helper: 1, squad: 2, member: 2 };
    expect(pairsOk([lent, { helper: 1, squad: 2, member: 3 }], members)).toBe(false);
    expect(pairsOk([{ helper: 1, squad: 1, member: 2 }], members)).toBe(false);
  });

  it("serves active and growing members first, and missing data never pushes anyone down", () => {
    const known = { active: true, growing: true, tookPart: null };
    const members = [
      member(1, [20e6, 12e6]),
      member(2, [5e6]), // no data at all
      member(3, [5e6], { active: false, growing: false, tookPart: false }),
      member(4, [5e6], known),
      member(5, [8.5e6], known), // close: after everyone who needs help
    ];
    expect(helpOrder(members, T).map((m) => m.uid)).toEqual([4, 2, 3, 5]);
    // One spare squad: it goes to the member with good signals.
    expect(suggestPairs(members, T)).toEqual([{ helper: 1, squad: 2, member: 4 }]);
  });
});
