// Issue 489: the Insights page's arithmetic. Invented names and values only.
import { describe, expect, it } from "vitest";

import type { RosterMember, RosterRead } from "../repo/workspace-rosters";
import {
  bandsOf,
  cameFrom,
  effortsOf,
  movesOf,
  newcomersOf,
  pulseView,
  quietOf,
  type PulseView,
  tenureOf,
  wentTo,
} from "./insights-rules";

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

describe("the week's pulse (issue 489)", () => {
  it("counts each day's read, leaves a day with no read out, and pools each of the 5 weeks", () => {
    // `active` is the running total since Monday's reset (#739). On Tuesday member 1's stayed at 200 (no
    // quests that day) and they sent no coins, and member 2 sent no donation: each counts as none, out of
    // the members the read lists. Wednesday 2026-11-18 has no read, so Thursday's quest points are no data.
    const reads = [
      read("2026-11-09", [member(1, { active: 200 }), member(2, { active: 200 })]),
      read("2026-11-16", [member(1, { active: 200 }), member(2, { active: 200, dailyHonor: 400 })]),
      read("2026-11-17", [
        member(1, { active: 200, dailyHonor: null }),
        member(2, { active: 400, dailyTech: null }),
      ]),
      read("2026-11-19", [member(1, { active: 600 }), member(2, { active: 600 })]),
    ];
    const v = pulseView(reads) as PulseView;
    expect(v.days.map((d) => (d.pulse === null || d.pulse === "later" ? d.pulse : "read"))).toEqual(
      ["read", "read", null, "read", "later", "later", "later"],
    );
    expect(v.days[1]?.pulse).toEqual({
      quests: { n: 1, of: 2 },
      coins: { n: 1, of: 2 },
      donated: { n: 1, of: 2 },
      tech: { value: 5000, of: 1 },
    });
    expect(v.days[3]?.pulse).toMatchObject({ quests: null });
    expect(v.weeks.map((w) => [w.monday, w.reads])).toEqual([
      ["2026-10-19", 0],
      ["2026-10-26", 0],
      ["2026-11-02", 0],
      ["2026-11-09", 1],
      ["2026-11-16", 3],
    ]);
    // Monday 2 of 2, Tuesday 1 of 2, Thursday not known.
    expect(v.weeks[4]?.quests).toEqual({ n: 3, of: 4 });
    expect(v.weeks[4]?.coins).toEqual({ n: 4, of: 6 });
    expect(v.weeks[0]?.quests).toBeNull();
  });
});

describe("effort at every might level (issue 489)", () => {
  // Eight members: might 1M … 8M. The two lowest do the most; 8 is left out (on a break). `active` is the
  // running total since Monday's reset (#739): Tuesday 17 has no Monday read, so its quest points are no
  // data; members 5 to 7 are first listed with a total on Wednesday, so only their Thursday counts.
  const mk = (uid: number, active: number | null, tech: number | null) =>
    member(uid, {
      name: `Name ${String.fromCharCode(105 - uid)}`,
      power: uid * 1_000_000,
      active,
      dailyTech: tech,
    });
  const reads = [
    read("2026-11-17", [mk(1, 100, 9000), mk(2, 100, 8000), mk(3, 100, 100), mk(4, 100, 200)]),
    read("2026-11-18", [
      mk(1, 1000, 9000),
      mk(2, 900, 8000),
      mk(3, 200, 100),
      mk(4, 300, 200),
      mk(5, 100, 300),
      mk(6, 100, 400),
      mk(7, 100, 500),
    ]),
    read("2026-11-19", [
      mk(1, 1900, 9000),
      mk(2, 1600, 8000),
      mk(3, 200, 100),
      mk(4, 500, 200),
      mk(5, 400, 300),
      mk(6, 500, 400),
      mk(7, 600, 500),
      mk(8, 999, 99_999),
    ]),
  ];

  it("averages the reads that list a member, none as 0, and makes four bands of might, the highest first", () => {
    const efforts = effortsOf(reads, new Set([8]));
    expect(efforts.find((e) => e.uid === 3)?.quests).toEqual({ value: 50, days: 2, none: 1 });
    const bands = bandsOf(efforts);
    expect(bands.map((b) => [b.low, b.high, b.uids])).toEqual([
      [6_000_000, 7_000_000, [6, 7]],
      [4_000_000, 5_000_000, [4, 5]],
      [2_000_000, 3_000_000, [2, 3]],
      [1_000_000, 1_000_000, [1]],
    ]);
    expect(bands[2]?.medians.quests).toEqual({ value: 400, of: 2 });
  });

  it("thanks the members below the median might and above it in quests and donations, in name order", () => {
    // Uid 2 is "Name g", uid 1 "Name h": name order puts 2 first.
    expect(quietOf(effortsOf(reads, new Set([8]))).map((e) => e.uid)).toEqual([2, 1]);
  });
});

describe("membership flow (issue 489)", () => {
  const reads = [
    read("2026-11-15", [member(1), member(2), member(3)]),
    read("2026-11-16", [member(1), member(2), member(4, { power: 5_000_000 })]),
    read("2026-11-18", [member(1), member(4, { power: 6_000_000 }), member(5)]),
  ];

  it("finds who joined and left between reads, where they came from and went, and unknown stays unknown", () => {
    const moves = movesOf(reads, "2026-11-16");
    expect(moves.joined.map((m) => [m.uid, m.day])).toEqual([
      [4, "2026-11-16"],
      [5, "2026-11-18"],
    ]);
    expect(moves.left.map((m) => [m.uid, m.before])).toEqual([
      [3, "2026-11-15"],
      [2, "2026-11-16"],
    ]);
    const seen = [
      { uid: 4, day: "2026-11-10", unionId: 77 },
      { uid: 4, day: "2026-11-14", unionId: 88, tag: "OLD" },
      // After joining us: not where they came from.
      { uid: 5, day: "2026-11-19", unionId: 77 },
      { uid: 3, day: "2026-11-12", unionId: 99 },
      { uid: 3, day: "2026-11-17", unionId: 77 },
    ];
    expect(cameFrom(moves.joined, seen, 1)).toEqual([
      { unionId: 88, tag: "OLD", n: 1 },
      { unionId: 0, tag: null, n: 1 },
    ]);
    expect(wentTo(moves.left, seen, 1)).toEqual([
      { unionId: 77, tag: null, n: 1 },
      { unionId: 0, tag: null, n: 1 },
    ]);
  });

  it("bands tenure from the first read listing a member, and newcomers' growth from their first day", () => {
    const firstSeen = new Map([
      [1, "2026-08-01"],
      [4, "2026-11-16"],
      [5, "2026-11-18"],
      [6, "2026-10-10"],
    ]);
    expect(tenureOf([1, 4, 5, 6], firstSeen, "2026-08-01", "2026-11-18")).toEqual({
      under: [[4, 5], [], [6]],
      over: [],
      sinceStart: [1],
      span: 109,
    });
    expect(newcomersOf(reads, firstSeen, "2026-08-01")).toEqual({
      uids: [4, 5],
      counted: 2,
      grew: 1,
      median: { value: 0.1, of: 2 },
    });
  });
});
