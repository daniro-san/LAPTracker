import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import { findBlockedKeys } from "./blocked-keys";
import { memberTurnout, memberTurnoutSoFar } from "./turnout";

type Member = { uid: number; kills: number | null };
type Row = { unionId: number; fresh?: boolean; members: Member[] };

let db: Db;
let day = 0;

/** One event with a Start and an End snapshot; returns the snapshots as the event page reads them. */
async function seedEvent(sides: { before: Row[]; after: Row[] }) {
  const at = new Date(Date.UTC(2026, 9, 1 + day++, 14));
  const [event] = await db
    .insert(events)
    .values({ name: `Event ${day}`, eventAtUtc: at, allianceIds: [1], beforeAt: at, afterAt: at })
    .returning({ id: events.id });
  const eventId = (event as { id: number }).id;
  const ids = {} as Record<"before" | "after", number>;
  for (const phase of ["before", "after"] as const) {
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId, phase, startedAt: at, status: "complete" })
      .returning({ id: snapshots.id });
    ids[phase] = (snap as { id: number }).id;
    for (const r of sides[phase]) {
      const [alliance] = await db
        .insert(allianceSnapshots)
        .values({
          snapshotId: ids[phase],
          unionId: r.unionId,
          tag: `T${r.unionId}`,
          source: "v1",
          isFresh: r.fresh ?? true,
          rawJson: { members: [{ uid: 1, x: 1, y: 2, online: true }] },
        })
        .returning({ id: allianceSnapshots.id });
      if (r.members.length === 0) continue;
      await db.insert(memberSnapshots).values(
        r.members.map((m) => ({
          allianceSnapshotId: (alliance as { id: number }).id,
          name: `P${m.uid}`,
          lv: 1,
          power: 1,
          ...m,
        })),
      );
    }
  }
  return [
    { id: ids.before, phase: "before" as const },
    { id: ids.after, phase: "after" as const },
  ];
}

const m = (uid: number, kills: number | null): Member => ({ uid, kills });

beforeAll(async () => {
  db = await openTestDb();
});

describe("memberTurnout (#271)", () => {
  it("counts the members whose kills rose, not those whose kills held", async () => {
    const snaps = await seedEvent({
      before: [{ unionId: 1, members: [m(1, 10), m(2, 10), m(3, 10), m(4, 10)] }],
      after: [{ unionId: 1, members: [m(1, 15), m(2, 10), m(3, 12), m(4, 10)] }],
    });
    const lists = await memberTurnout(db, snaps, undefined);
    expect(lists?.withKills[0]).toMatchObject({ unionId: 1, n: 4, gainers: 2, gained: 7 });
  });

  it("leaves out a member who is in one roster only", async () => {
    const snaps = await seedEvent({
      before: [{ unionId: 1, members: [m(1, 0), m(2, 0), m(3, 0)] }],
      after: [{ unionId: 1, members: [m(1, 5), m(3, 0), m(9, 500)] }],
    });
    const lists = await memberTurnout(db, snaps, undefined);
    expect(lists?.withKills[0]).toMatchObject({ n: 2, gainers: 1, gained: 5 });
  });

  it("gives an alliance with a stale or failed side no figure", async () => {
    const snaps = await seedEvent({
      before: [
        { unionId: 1, members: [m(1, 0)] },
        { unionId: 2, members: [m(2, 0)] },
        { unionId: 3, members: [m(3, 0)] },
      ],
      after: [
        { unionId: 1, members: [m(1, 5)] },
        { unionId: 2, fresh: false, members: [m(2, 5)] },
        { unionId: 3, members: [] },
      ],
    });
    const lists = await memberTurnout(db, snaps, undefined);
    expect(lists?.withKills.map((t) => t.unionId)).toEqual([1]);
  });

  it("takes the top 5 gains' share of all the kills gained, whole when fewer than 5 gained", async () => {
    const start = [1, 2, 3, 4, 5, 6, 7].map((uid) => m(uid, 0));
    const snaps = await seedEvent({
      before: [
        { unionId: 1, members: start },
        { unionId: 2, members: [m(21, 0), m(22, 0), m(23, 0)] },
      ],
      after: [
        { unionId: 1, members: [100, 50, 30, 20, 10, 1, 0].map((k, i) => m(i + 1, k)) },
        { unionId: 2, members: [m(21, 7), m(22, 3), m(23, 0)] },
      ],
    });
    const lists = await memberTurnout(db, snaps, undefined);
    const byId = new Map(lists?.topShare.map((t) => [t.unionId, t]));
    expect(byId.get(1)).toMatchObject({ top: 210, gained: 211 });
    expect(byId.get(2)).toMatchObject({ top: 10, gained: 10 });
    expect(lists?.topShare.map((t) => t.unionId)).toEqual([2, 1]);
    expect(lists?.withKills.map((t) => t.unionId)).toEqual([1, 2]);
    expect(findBlockedKeys(lists)).toEqual([]);
  });

  it("is null when nobody gained kills, so the section is not shown", async () => {
    const snaps = await seedEvent({
      before: [{ unionId: 1, members: [m(1, 10), m(2, 4)] }],
      after: [{ unionId: 1, members: [m(1, 10), m(2, 4)] }],
    });
    expect(await memberTurnout(db, snaps, undefined)).toBeNull();
  });

  it("ranks the top-5 share of alliances with 10 gainers or more before the rest", async () => {
    const many = Array.from({ length: 12 }, (_, i) => i + 1);
    const snaps = await seedEvent({
      before: [
        { unionId: 1, members: many.map((uid) => m(uid, 0)) },
        { unionId: 2, members: [m(41, 0), m(42, 0)] },
      ],
      // Alliance 1 gains evenly (5 of 12 = 42 %); alliance 2 has two gainers (100 %).
      after: [
        { unionId: 1, members: many.map((uid) => m(uid, 10)) },
        { unionId: 2, members: [m(41, 9), m(42, 1)] },
      ],
    });
    const lists = await memberTurnout(db, snaps, undefined);
    expect(lists?.topShare.map((t) => t.unionId)).toEqual([1, 2]);
  });
});

describe("memberTurnoutSoFar (#307)", () => {
  it("compares the Start roster with each alliance's newest usable sample, not a stale or older one", async () => {
    const at = new Date(Date.UTC(2026, 11, 1, 12));
    const [event] = await db
      .insert(events)
      .values({ name: "Live", eventAtUtc: at, allianceIds: [1], beforeAt: at, afterAt: at })
      .returning({ id: events.id });
    const eventId = (event as { id: number }).id;
    const snap = async (phase: "before" | "sample", slot: number | null) => {
      const [row] = await db
        .insert(snapshots)
        .values({
          eventId,
          phase,
          startedAt: at,
          status: "complete",
          slotAt: slot === null ? null : new Date(at.getTime() + slot * 60_000),
        })
        .returning({ id: snapshots.id });
      return (row as { id: number }).id;
    };
    const start = await snap("before", null);
    for (const unionId of [1, 2]) {
      const [a] = await db
        .insert(allianceSnapshots)
        .values({
          snapshotId: start,
          unionId,
          tag: `T${unionId}`,
          source: "v1",
          isFresh: true,
          rawJson: {},
        })
        .returning({ id: allianceSnapshots.id });
      await db.insert(memberSnapshots).values(
        [1, 2].map((uid) => ({
          allianceSnapshotId: (a as { id: number }).id,
          uid,
          name: `P${uid}`,
          lv: 1,
          power: 1,
          kills: 10,
        })),
      );
    }
    const sample = async (slot: number, rows: [number, number[], boolean][]) => {
      const id = await snap("sample", slot);
      for (const [unionId, kills, isFresh] of rows)
        await db.insert(allianceSnapshots).values({
          snapshotId: id,
          unionId,
          tag: `T${unionId}`,
          source: "v1",
          isFresh,
          rawJson: {},
          memberUids: [1, 2],
          memberKills: kills,
        });
    };
    await sample(15, [
      [1, [20, 10], true],
      [2, [30, 10], true],
    ]);
    // Alliance 1 gains 5 more by the newest sample; alliance 2 is stale in it, so its 15-minute figures stand.
    await sample(30, [
      [1, [25, 10], true],
      [2, [90, 10], false],
    ]);
    const lists = await memberTurnoutSoFar(db, eventId, start);
    expect(lists?.soFar).toBe(true);
    const by = (id: number) => lists?.withKills.find((t) => t.unionId === id);
    expect(by(1)).toMatchObject({ n: 2, gainers: 1, gained: 15 });
    expect(by(2)).toMatchObject({ n: 2, gainers: 1, gained: 20 });
  });
});
