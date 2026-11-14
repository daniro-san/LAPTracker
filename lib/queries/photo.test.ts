import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { allianceSnapshots, events, memberSnapshots, playerFrames, snapshots } from "../schema";
import { photoColumns } from "./photo";

let db: Db;

beforeAll(async () => {
  db = await openTestDb();
  const at = new Date("2026-11-07T12:00:00Z");
  const [event] = await db
    .insert(events)
    .values({
      name: "Saturday Event 2026-11-07",
      eventAtUtc: at,
      allianceIds: [1],
      beforeAt: at,
      afterAt: at,
    })
    .returning({ id: events.id });
  const [snap] = await db
    .insert(snapshots)
    .values({
      eventId: (event as { id: number }).id,
      phase: "before",
      startedAt: at,
      status: "complete",
    })
    .returning({ id: snapshots.id });
  const [alliance] = await db
    .insert(allianceSnapshots)
    .values({
      snapshotId: (snap as { id: number }).id,
      unionId: 1,
      tag: "OGs",
      name: "OldGrandmas",
      source: "v1",
      isFresh: true,
    })
    .returning({ id: allianceSnapshots.id });
  const allianceSnapshotId = (alliance as { id: number }).id;
  await db.insert(memberSnapshots).values([
    { allianceSnapshotId, uid: 7, name: "Nana", frameId: 5001 },
    { allianceSnapshotId, uid: 8, name: "Gran", frameId: 5001 },
    { allianceSnapshotId, uid: 9, name: "Ma" },
  ]);
  await db.insert(playerFrames).values([
    { uid: 7, frameId: 5010, seenAt: at },
    { uid: 8, frameId: 5026, seenAt: at },
  ]);
});

describe("photoColumns (D65)", () => {
  it("gives each member the player's current frame from player_frames, also in a select from member_snapshots alone", async () => {
    const rows = await db
      .select({ uid: memberSnapshots.uid, ...photoColumns })
      .from(memberSnapshots)
      .orderBy(memberSnapshots.uid);
    expect(rows.map((r) => [r.uid, r.frameId])).toEqual([
      [7, 5010],
      [8, 5026],
      [9, null],
    ]);
  });
});
