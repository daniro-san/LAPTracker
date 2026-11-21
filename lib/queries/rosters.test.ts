import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import { rosterChanges } from "./rosters";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

const at = (hhmm: string) => new Date(`2026-11-21T${hhmm}:00Z`);

/** A snapshot of alliance 1 with `members` as [uid, kills, power]: member rows, or a sample's arrays. */
async function reading(
  eventId: number,
  phase: "before" | "sample" | "after",
  time: string,
  members: [number, number, number][],
) {
  const [snap] = await db
    .insert(snapshots)
    .values({
      eventId,
      phase,
      slotAt: phase === "sample" ? at(time) : null,
      startedAt: at(time),
      status: "complete",
    })
    .returning({ id: snapshots.id });
  const snapshotId = (snap as { id: number }).id;
  const arrays = phase === "sample" && {
    memberUids: members.map(([uid]) => uid),
    memberNames: members.map(([uid]) => `m${uid}`),
    memberKills: members.map(([, kills]) => kills),
    memberPower: members.map(([, , power]) => power),
  };
  const [row] = await db
    .insert(allianceSnapshots)
    .values({ snapshotId, unionId: 1, source: "v1", isFresh: true, ...arrays })
    .returning({ id: allianceSnapshots.id });
  if (phase !== "sample") {
    const allianceSnapshotId = (row as { id: number }).id;
    await db.insert(memberSnapshots).values(
      members.map(([uid, kills, power]) => ({
        allianceSnapshotId,
        uid,
        name: `m${uid}`,
        kills,
        power,
      })),
    );
  }
  return snapshotId;
}

describe("rosterChanges (D69 amendment, 2026-11-21)", () => {
  it("counts a joiner's figures at his first reading in the alliance and a leaver's at the Start", async () => {
    const [ev] = await db
      .insert(events)
      .values({
        name: "Event",
        eventAtUtc: at("14:00"),
        allianceIds: [1],
        beforeAt: at("12:00"),
        afterAt: at("16:00"),
      })
      .returning({ id: events.id });
    const eventId = (ev as { id: number }).id;
    const before = await reading(eventId, "before", "12:00", [
      [11, 100, 1_000],
      [12, 200, 2_000],
    ]);
    // Member 13 joins with 5,000 lifetime kills and gains 30 more by the End; member 12 leaves.
    await reading(eventId, "sample", "12:15", [
      [11, 110, 1_000],
      [12, 200, 2_000],
      [13, 5_000, 9_000],
    ]);
    const after = await reading(eventId, "after", "16:00", [
      [11, 150, 1_000],
      [13, 5_030, 8_500],
    ]);
    const change = (await rosterChanges(db, eventId, { before, after })).get(1);
    expect(change).toEqual({
      joined: 1,
      left: 1,
      kills: { joined: 5_000, left: 200 },
      power: { joined: 9_000, left: 2_000 },
    });
  });
});
