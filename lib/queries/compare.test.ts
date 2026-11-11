import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import { findBlockedKeys } from "./blocked-keys";
import { compareEvents, getComparePage } from "./compare";
import { comparePlayer } from "./compare-player";
import { playerHistory } from "./players";

type Member = { uid: number; power: number; kills: number };
type Row = { unionId: number; fresh: boolean; members: Member[] };

let db: Db;
let eventA: number;
let eventB: number;

/** One event with a before and an after snapshot; each alliance's totals are its members' sums. */
async function seedEvent(day: string, sides: { before: Row[]; after: Row[] }) {
  const at = new Date(`${day}T14:00:00Z`);
  const [event] = await db
    .insert(events)
    .values({
      name: `Saturday Event ${day}`,
      eventAtUtc: at,
      allianceIds: [1, 2],
      beforeAt: at,
      afterAt: at,
    })
    .returning({ id: events.id });
  const eventId = (event as { id: number }).id;
  for (const phase of ["before", "after"] as const) {
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId, phase, startedAt: at, status: "complete" })
      .returning({ id: snapshots.id });
    for (const r of sides[phase]) {
      const [alliance] = await db
        .insert(allianceSnapshots)
        .values({
          snapshotId: (snap as { id: number }).id,
          unionId: r.unionId,
          tag: `T${r.unionId}`,
          source: "v1",
          isFresh: r.fresh,
          memberCount: r.members.length,
          totalPower: r.members.reduce((t, m) => t + m.power, 0),
          totalKills: r.members.reduce((t, m) => t + m.kills, 0),
          rawJson: { members: [{ uid: 1, x: 1, y: 2, online: true }] },
        })
        .returning({ id: allianceSnapshots.id });
      await db.insert(memberSnapshots).values(
        r.members.map((m) => ({
          allianceSnapshotId: (alliance as { id: number }).id,
          name: `P${m.uid}`,
          lv: 1,
          ...m,
        })),
      );
    }
  }
  return eventId;
}

const m = (uid: number, power: number, kills: number): Member => ({ uid, power, kills });

beforeAll(async () => {
  db = await openTestDb();
  // A: alliance 1 loses 30 might while P12 leaves; alliance 2 gains 5.
  eventA = await seedEvent("2026-10-24", {
    before: [
      { unionId: 1, fresh: true, members: [m(11, 100, 10), m(12, 20, 1)] },
      { unionId: 2, fresh: true, members: [m(21, 50, 5)] },
    ],
    after: [
      { unionId: 1, fresh: true, members: [m(11, 90, 14)] },
      { unionId: 2, fresh: true, members: [m(21, 55, 6)] },
    ],
  });
  // B: alliance 1 gains 10; alliance 2's after is stale, so it has no change in B.
  eventB = await seedEvent("2026-10-31", {
    before: [
      { unionId: 1, fresh: true, members: [m(11, 95, 15)] },
      { unionId: 2, fresh: true, members: [m(21, 60, 6)] },
    ],
    after: [
      { unionId: 1, fresh: true, members: [m(11, 105, 18)] },
      { unionId: 2, fresh: false, members: [m(21, 61, 6)] },
    ],
  });
});

describe("compareEvents (D57)", () => {
  it("gives a stale side no change and sums the totals over alliances usable in both events", async () => {
    const c = await compareEvents(db, eventA, eventB);
    const byId = new Map(c?.alliances.map((r) => [r.unionId, r]));
    expect(byId.get(1)?.a).toMatchObject({
      change: { power: -30, kills: 3 },
      members: { change: -1, left: 1 },
    });
    expect(byId.get(2)?.a?.change).toEqual({ power: 5, kills: 1 });
    expect(byId.get(2)?.b?.change).toBeNull();
    expect(c?.totals).toMatchObject({ counted: 1, of: 2, a: { power: -30 }, b: { power: 10 } });
  });

  it("lists one alliance's members per event, with no side where the member was not in it", async () => {
    const c = await compareEvents(db, eventA, eventB, 1);
    const left = c?.members?.find((x) => x.uid === 12);
    expect(c?.alliances.map((r) => r.unionId)).toEqual([1]);
    expect(left?.a).toMatchObject({ power: 20, change: null });
    expect(left?.b).toBeNull();
    expect(c?.members?.find((x) => x.uid === 11)?.b?.change).toEqual({ power: 10, kills: 3 });
    expect(findBlockedKeys(c)).toEqual([]);
  });

  it("defaults to the home event as B and the newest event with data before it as A", async () => {
    const page = await getComparePage(db, { a: null, b: null, unionId: null });
    expect([page.a, page.b]).toEqual([eventA, eventB]);
    expect(page.comparison).not.toBeNull();
  });
});

describe("comparePlayer (issue 199)", () => {
  const uid = 340000000031;
  let eventC: number;
  let eventD: number;

  beforeAll(async () => {
    // Dated before A and B, so the tests above keep their events. The player is in alliance 1 in C
    // (second by might) and in alliance 2 in D (first).
    eventC = await seedEvent("2026-10-10", {
      before: [{ unionId: 1, fresh: true, members: [m(uid, 100, 10), m(41, 200, 20)] }],
      after: [{ unionId: 1, fresh: true, members: [m(uid, 110, 12), m(41, 200, 20)] }],
    });
    eventD = await seedEvent("2026-10-17", {
      before: [{ unionId: 2, fresh: true, members: [m(uid, 120, 12), m(51, 50, 5)] }],
      after: [{ unionId: 2, fresh: true, members: [m(uid, 125, 15), m(51, 50, 5)] }],
    });
  });

  it("reads a player who changed alliance in each event's own alliance, with no blocked key", async () => {
    const c = await comparePlayer(db, eventC, eventD, uid);
    expect(c?.player).toMatchObject({
      name: `P${uid}`,
      hasPage: true,
      a: { unionId: 1, tag: "T1", rank: 2, power: 110, change: { power: 10, kills: 2 } },
      b: { unionId: 2, tag: "T2", rank: 1, power: 125, change: { power: 5, kills: 3 } },
    });
    expect(c?.player.a?.opening).toEqual({ power: 100, kills: 10 });
    expect(findBlockedKeys(c)).toEqual([]);
  });

  it("shows the fresh alliance's row over a newer stale read of the old one, on both pages", async () => {
    const moved = 340000000032;
    // Alliance 1's stale read still lists the player; it is stored after alliance 2's fresh roster.
    const eventE = await seedEvent("2026-10-03", {
      before: [
        { unionId: 2, fresh: true, members: [m(moved, 80, 8)] },
        { unionId: 1, fresh: false, members: [m(moved, 70, 7)] },
      ],
      after: [
        { unionId: 2, fresh: true, members: [m(moved, 85, 9)] },
        { unionId: 1, fresh: false, members: [m(moved, 70, 7)] },
      ],
    });
    const c = await comparePlayer(db, eventC, eventE, moved);
    const history = await playerHistory(db, moved);
    expect(c?.player.b).toMatchObject({ unionId: 2, power: 85, change: { power: 5, kills: 1 } });
    expect(history?.current).toMatchObject({ unionId: 2, power: 85, isFresh: true });
    expect(history?.rows).toMatchObject([
      { unionId: 2, power: 85, inEvent: { power: 5, kills: 1 }, before: { isFresh: true } },
    ]);
  });
});
