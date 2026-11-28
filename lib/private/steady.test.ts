import { describe, expect, it } from "vitest";

import type { RosterMember, RosterRead } from "../repo/workspace-rosters";
import { gameWeek } from "./member-week";
import { steadyOf } from "./steady";

const member = (fields: Partial<RosterMember> = {}): RosterMember => ({
  uid: 1,
  name: "P1",
  power: 1000,
  kills: null,
  lv: 25,
  rankCode: 103,
  rankLabel: "R3",
  dailyTech: null,
  dailyHonor: 1000,
  active: 0,
  joinedAt: null,
  lastOnlineAt: null,
  x: 0,
  y: 0,
  ...fields,
});
const WEEK = gameWeek("2026-11-09");
/** One read per listed day (index in WEEK); the member's quest points total rises by 100 a read, as asked. */
const reads = (days: number[], fields: (n: number) => Partial<RosterMember> = () => ({})) =>
  days.map((n): RosterRead => ({
    day: WEEK[n] as string,
    at: new Date(`${WEEK[n]}T01:37:00Z`),
    members: [member({ active: 100 * (n + 1), ...fields(n) })],
  }));

describe("steadyOf (issue 465)", () => {
  it("names a member with all 1,000 coins and quest points above 0 on every day with a read", () => {
    expect(steadyOf(reads([0, 1, 2, 3, 4, 5, 6]), WEEK, 1)).toEqual({ help: true, quests: true });
  });

  it("does not name a member whose coins fall short, or who earned no quest points, on one day", () => {
    const short = reads([0, 1, 2, 3, 4], (n) => ({ dailyHonor: n === 3 ? 999 : 1000 }));
    // A null `daily_honor` on a read that lists them is nothing that day: 0 coins.
    const none = reads([0, 1, 2, 3, 4], (n) => ({ dailyHonor: n === 3 ? null : 1000 }));
    const flat = reads([0, 1, 2, 3, 4], (n) => ({ active: n >= 2 ? 200 : 100 * (n + 1) }));

    expect(steadyOf(short, WEEK, 1)).toEqual({ help: false, quests: true });
    expect(steadyOf(none, WEEK, 1).help).toBe(false);
    expect(steadyOf(flat, WEEK, 1)).toEqual({ help: true, quests: false });
  });

  it("names nobody with fewer than 5 days of data, whatever the days say", () => {
    expect(steadyOf(reads([0, 1, 2, 3]), WEEK, 1)).toEqual({ help: false, quests: false });
    expect(steadyOf(reads([0, 1, 2, 3, 4]), WEEK, 1)).toEqual({ help: true, quests: true });
  });

  it("does not count a day with no read against anyone (D75)", () => {
    // No read on Wednesday: Thursday's quest points have no day before, so they are no data too.
    const days = steadyOf(reads([0, 1, 3, 4, 5, 6]), WEEK, 1);

    expect(days).toEqual({ help: true, quests: true });
  });
});
