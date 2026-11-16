import { describe, expect, it } from "vitest";

import type { RosterMember, RosterRead } from "../repo/workspace-rosters";
import { gameWeek, idleRun, isNewMember, topOf, weekDonations, weekTotal } from "./member-week";

const member = (uid: number, fields: Partial<RosterMember> = {}): RosterMember => ({
  uid,
  name: `P${uid}`,
  power: 1000,
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

describe("the offline proxy (D75)", () => {
  it("is a reason after 2 days of unchanged activity and donations, with Monday's reset ignored", () => {
    const reads = [
      read("2026-11-07", [member(1, { active: 50 }), member(2, { active: 50 }), member(3)]),
      read("2026-11-08", [member(1, { active: 50 }), member(2, { active: 50 }), member(3)]),
      // Monday: the weekly activity starts again from 0.
      read("2026-11-09", [member(1), member(2, { active: 10 }), member(3, { active: null })]),
      read("2026-11-10", [member(1), member(2, { active: 10 }), member(3)]),
    ];

    expect(idleRun(reads, 1)).toEqual({ days: 3, activity: 0, donated: 0 });
    // Member 2 was active on Monday; member 3's Monday is unknown, which never counts.
    expect(idleRun(reads, 2)).toBeNull();
    expect(idleRun(reads, 3)).toBeNull();
    // One unchanged day is not enough, and a day with no read ends the run.
    expect(idleRun(reads.slice(2), 1)).toBeNull();
    expect(idleRun([reads[0], reads[1], reads[3]] as RosterRead[], 1)).toBeNull();
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
