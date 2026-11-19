import { describe, expect, it } from "vitest";

import type { RosterMember, RosterRead } from "../repo/workspace-rosters";
import { signalsOf } from "./garrison-signals";
import {
  gameWeek,
  idleRun,
  isNewMember,
  missingOf,
  topOf,
  weekDonations,
  weekQuestPoints,
  weekTotal,
} from "./member-week";

const member = (uid: number, fields: Partial<RosterMember> = {}): RosterMember => ({
  uid,
  name: `P${uid}`,
  power: 1000,
  kills: null,
  lv: 25,
  rankCode: 103,
  rankLabel: "R3",
  dailyTech: 0,
  dailyHonor: 0,
  active: 0,
  joinedAt: null,
  lastOnlineAt: null,
  x: 0,
  y: 0,
  ...fields,
});
const read = (day: string, members: RosterMember[]): RosterRead => ({
  day,
  at: new Date(`${day}T01:37:00Z`),
  members,
});

describe("the game week's donations (issue #296)", () => {
  it("sums the days with data, Monday to Sunday; a day with no read or no value is no data and not counted", () => {
    // Sunday 8 is the week before; Wednesday's value is null; Thursday has no read; Friday is the newest.
    const reads = [
      read("2026-11-08", [member(1, { dailyTech: 999 })]),
      read("2026-11-09", [member(1, { dailyTech: 100 })]),
      read("2026-11-10", [member(1, { dailyTech: 250 })]),
      read("2026-11-11", [member(1, { dailyTech: null })]),
      read("2026-11-13", [member(1, { dailyTech: 300 })]),
    ];
    const week = gameWeek("2026-11-13");

    const days = weekDonations(reads, week, 1);

    expect(week).toEqual([
      "2026-11-09",
      "2026-11-10",
      "2026-11-11",
      "2026-11-12",
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
    ]);
    expect(days).toEqual([100, 250, null, null, 300, "later", "later"]);
    expect(weekTotal(days)).toBe(650);
    expect(weekTotal([null, null, "later"])).toBeNull();
  });
});

describe("the week's daily quest points (D127)", () => {
  it("sums the days of the newest read's game week, so thanks and picks never hang on one day", () => {
    // Sunday 8 is the week before; on Wednesday 11, the newest read, member 1 has no quests yet.
    const reads = [
      read("2026-11-08", [member(1, { active: 999 }), member(2, { active: 999 })]),
      read("2026-11-09", [member(1, { active: 700 }), member(2, { active: null })]),
      read("2026-11-10", [member(1, { active: 300 }), member(2, { active: null })]),
      read("2026-11-11", [member(1, { active: null }), member(2, { active: null })]),
    ];

    expect(weekQuestPoints(reads, 1)).toBe(1000);
    expect(weekQuestPoints(reads, 2)).toBeNull();
    // The garrison's "active" signal reads the same week.
    expect([1, 2].map((uid) => signalsOf(reads, [])(uid).active)).toEqual([true, null]);
  });
});

describe("the offline proxy (D75, D127)", () => {
  const none = { active: null, dailyTech: null };

  it("is a reason after 3 end-of-day reads in a row with no quest points and no donations", () => {
    const reads = [
      read("2026-11-09", [member(1, { active: 700 }), member(2, none)]),
      read("2026-11-10", [member(1, none), member(2, none)]),
      read("2026-11-11", [member(1, none), member(2, { active: null, dailyTech: 500 })]),
      read("2026-11-12", [member(1, none), member(2, none)]),
    ];

    expect(idleRun(reads, 1)).toEqual({ days: 3 });
    // Member 2 donated on the 11th: one read with nothing is not enough.
    expect(idleRun(reads, 2)).toBeNull();
  });

  it("does not count across a failed read", () => {
    // The read of the 11th failed, so it is not among the reads: two runs of two, never one of four.
    const reads = ["2026-11-09", "2026-11-10", "2026-11-12", "2026-11-13"].map((day) =>
      read(day, [member(1, none)]),
    );

    expect(idleRun(reads, 1)).toBeNull();
    expect(idleRun([...reads, read("2026-11-14", [member(1, none)])], 1)).toEqual({ days: 3 });
  });

  it("does not count a read that does not list the member", () => {
    const reads = [
      read("2026-11-10", [member(1)]),
      read("2026-11-11", [member(1), member(2, none)]),
      read("2026-11-12", [member(1), member(2, none)]),
    ];

    expect(idleRun(reads, 2)).toBeNull();
  });
});

describe("missing data", () => {
  it("lists what the newest read did not tell, and the days of the week so far with no donations", () => {
    expect(missingOf(member(1), [100, 200, "later"])).toEqual({ fields: [], days: 0 });
    expect(
      missingOf(member(2, { power: null, lv: null, active: null }), [null, 200, null, "later"]),
    ).toEqual({ fields: ["might", "sanctuary", "donations"], days: 2 });
  });
});

describe("new members", () => {
  it("are first seen after the oldest roster and less than 14 days ago, and stay out of the thanks", () => {
    expect(isNewMember("2026-11-10", "2026-11-01", "2026-11-15")).toBe(true);
    expect(isNewMember("2026-11-01", "2026-11-01", "2026-11-15")).toBe(false);
    expect(isNewMember("2026-11-01", "2026-10-01", "2026-11-15")).toBe(false);

    const rows = [
      { uid: 1, name: "Old", isNew: false, total: 500 },
      { uid: 2, name: "New", isNew: true, total: 900 },
      { uid: 3, name: "Zero", isNew: false, total: 0 },
    ];
    expect(topOf(rows, (r) => r.total)).toEqual([{ uid: 1, name: "Old", value: 500 }]);
  });
});
