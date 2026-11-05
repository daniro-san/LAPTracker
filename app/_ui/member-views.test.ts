import { describe, expect, it } from "vitest";

import {
  canCompare,
  filterMembers,
  memberViews,
  mightSteps,
  type MemberFilter,
  type MemberView,
} from "./member-views";

const member = (uid: number, name: string, before: number | null, after: number | null) =>
  ({
    uid,
    name,
    hasAvatar: false,
    wasName: null,
    status: before === null ? "joined" : after === null ? "left" : "",
    before: before === null ? null : { power: before, kills: before / 10, lv: 20 },
    after: after === null ? null : { power: after, kills: after / 10, lv: 20 },
    rank: { before: null, after: null },
  }) as MemberView;

describe("filterMembers", () => {
  const members = [
    member(1, "Ann", 50, 60),
    member(2, "Bob", 90, 80),
    member(3, "Cid", null, 30),
    member(4, "Dana", 70, null),
  ];
  const steps = mightSteps(members); // [30, 60, 70, 80]
  const all: MemberFilter = { sort: "might", desc: true, name: "", lo: 0, hi: steps.length - 1 };
  const names = (f: Partial<MemberFilter>, canDelta = true) =>
    filterMembers(members, { ...all, ...f }, steps, canDelta).map((m) => m.name);

  it("keeps members inside the might range, with the range ends on the roster's own values", () => {
    expect(steps).toEqual([30, 60, 70, 80]);
    expect(names({ lo: 1, hi: 2 })).toEqual(["Dana", "Ann"]);
  });

  it("sorts by change with members without one last, flips on desc, and searches names", () => {
    expect(names({ sort: "mightDelta" })).toEqual(["Ann", "Bob", "Cid", "Dana"]);
    expect(names({ sort: "name", desc: false, name: "a" })).toEqual(["Ann", "Dana"]);
  });
});

describe("memberViews", () => {
  const row = (uid: number, name: string, power: number) => ({
    uid,
    name,
    power,
    kills: 1,
    lv: 20,
    hasAvatar: false,
  });
  const before = [row(1, "Ann", 50), row(2, "Bob", 90), row(4, "Dana", 70)];

  it("shows the Before roster as the current roster, with no joined or left, while there is no After", () => {
    const views = memberViews(before, []);
    expect(views.map((m) => m.status)).toEqual(["", "", ""]);
    expect(views.map((m) => m.rank.before)).toEqual([3, 1, 2]);
    expect(canCompare(before, [])).toBe(false);
  });

  it("still marks joined and left when both rosters exist", () => {
    const views = memberViews(before, [row(1, "Ann", 60), row(3, "Cid", 30)]);
    expect(Object.fromEntries(views.map((m) => [m.name, m.status]))).toEqual({
      Ann: "",
      Cid: "joined",
      Bob: "left",
      Dana: "left",
    });
  });
});
