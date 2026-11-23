// Issue 466: the alliance's week in one line. Invented names and values only.
import { describe, expect, it } from "vitest";

import type { RosterMember, RosterRead } from "../repo/workspace-rosters";
import { allianceWeek } from "./alliance-week";

const member = (uid: number, over: Partial<RosterMember> = {}): RosterMember => ({
  uid,
  name: `Invented ${uid}`,
  power: 10_000_000,
  kills: null,
  lv: null,
  rankCode: null,
  rankLabel: null,
  dailyTech: 5000,
  dailyHonor: 1000,
  active: 600,
  joinedAt: null,
  lastOnlineAt: null,
  x: null,
  y: null,
  ...over,
});
const read = (day: string, members: RosterMember[]): RosterRead => ({
  day,
  at: new Date(`${day}T23:30:00Z`),
  members,
});

describe("the alliance's week in one line (issue 466)", () => {
  it("counts the coin cap out of every member the newest read lists, a null being none (D127)", () => {
    const newest = read("2026-11-19", [
      member(1),
      member(2, { dailyHonor: 999 }),
      member(3, { dailyHonor: null }),
      member(4),
    ]);
    expect(allianceWeek([newest], "2026-11-20")?.coins).toEqual({ n: 2, of: 4 });
  });

  it("takes the median of the newest day's quest points, from the week's running total, of those who did daily quests that day (#739)", () => {
    // Wednesday 18 to Thursday 19: member 1 earned 100, member 2 none (the total stayed), member 3 200,
    // member 4 150, and member 5 is not on Wednesday's read, so their day is not known.
    const reads = [
      read("2026-11-18", [
        member(1, { active: 400 }),
        member(2, { active: 480 }),
        member(3, { active: 500 }),
        member(4, { active: null }),
      ]),
      read("2026-11-19", [
        member(1, { active: 500 }),
        member(2, { active: 480 }),
        member(3, { active: 700 }),
        member(4, { active: 150 }),
        member(5, { active: 900 }),
      ]),
    ];
    expect(allianceWeek(reads, "2026-11-20")?.quests).toEqual({ value: 150, of: 3 });
    const none = [read("2026-11-18", [member(1)]), read("2026-11-19", [member(1)])];
    expect(allianceWeek(none, "2026-11-20")?.quests).toBeNull();
  });

  it("adds up the donations of the newest read's game week only", () => {
    const reads = [
      read("2026-11-15", [member(1, { dailyTech: 90_000 })]), // Sunday of the week before
      read("2026-11-16", [member(1, { dailyTech: 1000 }), member(2, { dailyTech: null })]),
      read("2026-11-17", [member(1, { dailyTech: 2000 }), member(2, { dailyTech: 500 })]),
    ];
    const w = allianceWeek(reads, "2026-11-18");
    expect(w).toMatchObject({ monday: "2026-11-16", donations: 3500 });
    const silent = [read("2026-11-16", [member(1, { dailyTech: null })])];
    expect(allianceWeek(silent, "2026-11-17")?.donations).toBeNull();
  });

  it("names the week's past days with no read, never today, and is null before any read (D75)", () => {
    // Monday 16 read; Tuesday 17 failed; Wednesday 18 read; today is Friday 20, before its read.
    const reads = [read("2026-11-16", [member(1)]), read("2026-11-18", [member(1)])];
    expect(allianceWeek(reads, "2026-11-20")?.noRead).toEqual(["2026-11-17", "2026-11-19"]);
    // Reads up to Sunday 22; today is Tuesday 24 and Monday 23 failed: Monday is named too.
    const older = [read("2026-11-16", [member(1)]), read("2026-11-22", [member(1)])];
    expect(allianceWeek(older, "2026-11-24")?.noRead).toEqual([
      "2026-11-17",
      "2026-11-18",
      "2026-11-19",
      "2026-11-20",
      "2026-11-21",
      "2026-11-23",
    ]);
    expect(allianceWeek([], "2026-11-20")).toBeNull();
  });
});
