import { describe, expect, it } from "vitest";

import type { RosterMember, RosterRead } from "../repo/workspace-rosters";
import { signalsOf } from "./garrison-signals";
import {
  gameWeek,
  idleRun,
  isNewMember,
  OFFLINE_GRACE_DAYS,
  missingOf,
  questDay,
  questPoints,
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
  it("sums the days with data, Monday to Sunday; a read with no value is none that day, a day with no read is no data (D127)", () => {
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
    expect(days).toEqual([100, 250, "none", null, 300, "later", "later"]);
    expect(weekTotal(days)).toBe(650);
    expect(weekTotal([null, null, "later"])).toBeNull();
  });
});

describe("a day's daily quest points from the week's running total (#739)", () => {
  // `active` counts the quest points since Monday's reset: Mon 16 to Wed 18 here.
  it("is the value itself on a Monday, whatever the Sunday before read", () => {
    expect(questDay("2026-11-16", 240, 1660)).toBe(240);
    expect(questDay("2026-11-16", 240, null)).toBe(240);
  });

  it("is the value less the day before's inside the week", () => {
    expect(questDay("2026-11-17", 480, 240)).toBe(240);
    expect(questDay("2026-11-18", 655, 480)).toBe(175);
  });

  it("starts again at the Monday reset, from Saturday through Sunday into Monday", () => {
    // Sat 21, Sun 22, Mon 23: the Monday read is lower than Sunday's and is still Monday's whole day.
    const reads = [
      read("2026-11-21", [member(1, { active: 1445 })]),
      read("2026-11-22", [member(1, { active: 1660 })]),
      read("2026-11-23", [member(1, { active: 230 })]),
    ];

    expect(["2026-11-22", "2026-11-23"].map((day) => questPoints(reads, 1, day))).toEqual([
      215, 230,
    ]);
  });

  it("starts again at the week's boundary, not at a drop: a Monday above Sunday's total is still Monday's whole day", () => {
    // Member 1 earned 100 in the whole week to Sunday 22, then 230 on Monday 23: no drop, still a reset.
    const reads = [
      read("2026-11-22", [member(1, { active: 100 })]),
      read("2026-11-23", [member(1, { active: 230 })]),
    ];

    expect(questPoints(reads, 1, "2026-11-23")).toBe(230);
  });

  it("is no data, never 0, when no read of the day before lists the member", () => {
    // Tuesday 17 has no Monday read; on Thursday 19 the Wednesday read does not list member 1.
    const reads = [
      read("2026-11-17", [member(1, { active: 480 })]),
      read("2026-11-18", [member(2, { active: 300 })]),
      read("2026-11-19", [member(1, { active: 900 })]),
    ];

    expect(questPoints(reads, 1, "2026-11-17")).toBeNull();
    expect(questPoints(reads, 1, "2026-11-19")).toBeNull();
  });

  it("is no data when the total drops inside one week", () => {
    expect(questDay("2026-11-18", 400, 480)).toBeNull();
  });

  it("is none on a day the total did not move, and on a read that sent null, even with no read the day before", () => {
    expect(questDay("2026-11-18", 480, 480)).toBe("none");
    // The game sends null for no points yet this week: 0 so far, so Wednesday's null is none that day,
    // although Tuesday had no read.
    const reads = [read("2026-11-18", [member(1, { active: null })])];
    expect(questPoints(reads, 1, "2026-11-18")).toBe("none");
  });
});

describe("the week's daily quest points (D127, #739)", () => {
  it("is the newest read of the game week, which holds the week so far, never the days added up", () => {
    // Sunday 8 is the week before; member 1 did 240 on Monday and Tuesday and none on Wednesday 11, the newest read.
    const reads = [
      read("2026-11-08", [member(1, { active: 1660 }), member(2, { active: 1660 })]),
      read("2026-11-09", [member(1, { active: 240 }), member(2, { active: null })]),
      read("2026-11-10", [member(1, { active: 480 }), member(2, { active: null })]),
      read("2026-11-11", [member(1, { active: 480 }), member(2, { active: null })]),
    ];

    expect(weekQuestPoints(reads, 1)).toBe(480);
    expect(weekQuestPoints(reads, 2)).toBeNull();
    // The garrison's "active" signal reads the same week.
    expect([1, 2].map((uid) => signalsOf(reads, [])(uid).active)).toEqual([true, null]);
  });
});

describe("the offline proxy (D75, D127)", () => {
  const none = { active: null, dailyTech: null };

  it("is a reason after 3 end-of-day reads in a row with no quest points and no donations", () => {
    // Member 1 did 700 quest points on Monday 9 and none after: the running total stays at 700.
    const idle = { active: 700, dailyTech: null };
    const reads = [
      read("2026-11-09", [member(1, { active: 700 }), member(2, none)]),
      read("2026-11-10", [member(1, idle), member(2, none)]),
      read("2026-11-11", [member(1, idle), member(2, { active: null, dailyTech: 500 })]),
      read("2026-11-12", [member(1, idle), member(2, none)]),
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
    // The offline signal's grace is 7 days (D127): 5 days in is still settling, 10 days in is not.
    expect(isNewMember("2026-11-10", "2026-11-01", "2026-11-15", OFFLINE_GRACE_DAYS)).toBe(true);
    expect(isNewMember("2026-11-05", "2026-11-01", "2026-11-15", OFFLINE_GRACE_DAYS)).toBe(false);

    const rows = [
      { uid: 1, name: "Old", isNew: false, total: 500 },
      { uid: 2, name: "New", isNew: true, total: 900 },
      { uid: 3, name: "Zero", isNew: false, total: 0 },
    ];
    expect(topOf(rows, (r) => r.total)).toEqual([{ uid: 1, name: "Old", value: 500 }]);
  });
});
