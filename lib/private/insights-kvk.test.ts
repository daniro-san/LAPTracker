// Issue 489: the Insights page's KvK cost and recovery and squads seen, pure. Invented names and values only.
import { describe, expect, it } from "vitest";

import type { SquadSighting } from "../repo/squads";
import type { EventMight, RosterMember, RosterRead } from "../repo/workspace-rosters";
import { kvkOf } from "./insights-kvk";
import { squadsCoverageOf } from "./insights-squads";

const ZONE = "Etc/GMT+2";
const member = (uid: number, power: number | null, name = `Invented ${uid}`) =>
  ({ uid, name, power }) as RosterMember;
const read = (day: string, members: RosterMember[]): RosterRead => ({
  day,
  at: new Date(`${day}T23:30:00Z`),
  members,
});
const event = (day: string, before: [number, number][], after: [number, number][]): EventMight => ({
  id: Date.parse(day),
  at: new Date(`${day}T14:00:00Z`),
  afterAt: new Date(`${day}T16:00:00Z`),
  before: new Map(before),
  after: new Map(after),
});

describe("KvK cost and recovery (issue 489)", () => {
  it("counts only members in both event reads and the newest, and shows the loss back day by day", () => {
    // 1 and 2 fought; 3 left after; 4 joined after; 5 has no might in the newest read.
    const kvk = event(
      "2026-11-14",
      [
        [1, 100],
        [2, 100],
        [3, 50],
        [5, 10],
      ],
      [
        [1, 60],
        [2, 100],
        [3, 40],
        [5, 5],
      ],
    );
    const reads = [
      read("2026-11-14", [member(1, 70), member(2, 100), member(3, 40), member(5, 5)]),
      read("2026-11-15", [member(1, 80), member(2, 100), member(5, 6)]),
      read("2026-11-16", [member(1, 90), member(2, 101), member(4, 30), member(5, null)]),
    ];

    const [e] = kvkOf([kvk], reads, ZONE, new Set());

    // 4 (joined) and 5 (no might now) are the other current members; 3 left.
    expect(e).toMatchObject({ day: "2026-11-14", members: 2, others: 2, left: 1 });
    expect([e?.before, e?.after, e?.now]).toEqual([200, 160, 191]);
    // From the day after the event, over the members each read lists: 20 of 40 back, then 31. The event
    // day's own read only repeats the End read.
    expect(e?.days.map((d) => d.share)).toEqual([0.5, 31 / 40]);
  });

  it("lists who lost more than a quarter and is still under 80% as shown, in name order, without members on a break", () => {
    const first = event(
      "2026-11-07",
      [
        [1, 100],
        [2, 100],
        [3, 100],
        [4, 100],
      ],
      [
        [1, 70],
        [2, 74],
        [3, 50],
        [4, 60],
      ],
    );
    const second = event(
      "2026-11-14",
      [
        [1, 100],
        [2, 100],
        [3, 100],
        [4, 100],
        [5, 1000],
        [6, 100],
      ],
      [
        [1, 70],
        [2, 74],
        [3, 50],
        [4, 60],
        [5, 600],
        [6, 50],
      ],
    );
    const newest = [
      // At 79.6%, shown as "80%": not under 80%. Dale is on a break.
      member(5, 796, "Eryn"),
      member(6, 50, "Dale"),
      member(1, 79, "Wren"),
      member(2, 75, "Ash"),
      member(3, 70, "Bryn"),
      member(4, 85, "Cael"),
    ];
    const reads = [read("2026-11-08", newest), read("2026-11-15", newest)];

    const [last, before] = kvkOf([first, second], reads, ZONE, new Set([6]));

    // Wren lost 30% and is at 79%, Ash 26% and 75%, Bryn 50% and 70%. Cael lost 40% and is back to 85%.
    expect(last?.help.map((p) => p.name)).toEqual(["Ash", "Bryn", "Wren"]);
    expect(last?.people.map((p) => p.name)).toEqual([
      "Ash",
      "Bryn",
      "Cael",
      "Dale",
      "Eryn",
      "Wren",
    ]);
    // The older event's recovery reads stop before the next event, and its "now" is its last one there;
    // its members are not listed again.
    expect(before?.days.map((d) => d.day)).toEqual(["2026-11-08"]);
    expect(before?.nowDay).toBe("2026-11-08");
    expect(before?.people).toEqual([]);
    expect(kvkOf([], reads, ZONE, new Set())).toEqual([]);
    // On KvK day before the night read, the newest read is older than the End: the event waits.
    expect(kvkOf([second], reads.slice(0, 1), ZONE, new Set())).toEqual([]);
  });
});

describe("squads seen (issue 489)", () => {
  it("counts squads seen per member with 3 or more as one row, how fresh each is, and strongest-squad groups", () => {
    const now = new Date("2026-11-21T12:00:00Z");
    const ago = (h: number) => new Date(now.getTime() - h * 3_600_000);
    const s = (uid: number, squad: number, power: number, seenAt: Date | null): SquadSighting => ({
      uid,
      squad,
      power,
      seenAt,
    });
    const sightings = [
      ...[1, 2, 3, 4].map((n) => s(1, n, 18_000_000 - n, ago(2))),
      s(2, 1, 9_000_000, ago(30)),
      s(2, 3, 4_000_000, ago(100)),
      s(3, 1, 20_000_000, null),
      s(5, 2, 6_000_000, ago(200)),
      // A former member's squads are not counted.
      s(9, 1, 50_000_000, ago(1)),
    ];

    const c = squadsCoverageOf([1, 2, 3, 4, 5], sightings, now);

    expect(c).toMatchObject({
      members: 5,
      counts: [2, 1, 1],
      none: 1,
      fresh: [1, 1, 1],
      noTime: 1,
    });
    // Four equal groups by strongest squad, the highest first: 20M, 18M, 9M and 6M.
    expect(c.bands.map((b) => [b.low, b.high, b.n])).toEqual([
      [20_000_000, 20_000_000, 1],
      [17_999_999, 17_999_999, 1],
      [9_000_000, 9_000_000, 1],
      [6_000_000, 6_000_000, 1],
    ]);
  });
});
