import { describe, expect, it } from "vitest";

import { suggest, type Candidate, type Role } from "./caravan-suggest";

/** The caravan being filled: Monday 2026-11-23, week key "1:2026-11-23". */
const caravan = { key: "1:2026-11-23", day: "2026-11-23", seated: [] as number[] };
const member = (uid: number, active: number | null, away = false): Candidate => ({
  uid,
  name: `P${uid}`,
  active,
  away,
});
const role = (uid: number, day: string, key = `2:${day}`): Role => ({ uid, day, key });

describe("caravan suggestions (issue 354)", () => {
  it("puts the most active first, then whoever waited longest, a member with no role yet first of all", () => {
    const members = [member(1, 50), member(2, 90), member(3, 90), member(4, 90)];
    const roles = [role(2, "2026-11-09"), role(3, "2026-11-02")];
    expect(suggest(members, roles, caravan)).toEqual([
      { uid: 4, name: "P4", activeThisWeek: true, lastRoleDays: null },
      { uid: 3, name: "P3", activeThisWeek: true, lastRoleDays: 21 },
      { uid: 2, name: "P2", activeThisWeek: true, lastRoleDays: 14 },
    ]);
  });

  it("leaves out the away, a role in the last 7 days and the seated; an unknown activity comes last", () => {
    const members = [
      member(1, 80, true),
      member(2, 80),
      member(3, 80),
      member(4, null),
      member(5, 0),
    ];
    const roles = [
      role(2, "2026-11-16"), // 7 days before: left out
      role(3, "2026-11-15"), // 8 days before: suggested
      role(5, "2026-11-30"), // after this caravan: not counted
      role(4, "2026-11-23", caravan.key), // this caravan's own seat
    ];
    const got = suggest(members, roles, { ...caravan, seated: [4] });
    expect(got.map((s) => s.uid)).toEqual([3, 5]);
    expect(got[1]).toEqual({ uid: 5, name: "P5", activeThisWeek: false, lastRoleDays: null });
    const unknown = suggest([member(4, null), member(6, 10)], [], caravan);
    expect(unknown.map((s) => [s.uid, s.activeThisWeek])).toEqual([
      [6, true],
      [4, false],
    ]);
  });
});
