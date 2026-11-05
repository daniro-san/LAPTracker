import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import { findBlockedKeys } from "./blocked-keys";
import { roleOf, rolesOf } from "./leadership";
import { playerHistory } from "./players";

const rank = (uid: number, rankCode: number, rankLabel: string) => ({
  uid,
  name: `M${uid}`,
  power: 1,
  kills: 1,
  lv: 1,
  rankCode,
  rankLabel,
});

let db: Db;
let withRanks: number;
let withoutRanks: number;

async function alliance(unionId: number, members: Record<string, unknown>[]) {
  const at = new Date(Date.UTC(2026, 9, 17, 14, unionId));
  const [event] = await db
    .insert(events)
    .values({
      name: `E${unionId}`,
      eventAtUtc: at,
      allianceIds: [unionId],
      beforeAt: at,
      afterAt: at,
    })
    .returning({ id: events.id });
  const [snap] = await db
    .insert(snapshots)
    .values({
      eventId: (event as { id: number }).id,
      phase: "after",
      startedAt: at,
      status: "complete",
    })
    .returning({ id: snapshots.id });
  const [row] = await db
    .insert(allianceSnapshots)
    .values({
      snapshotId: (snap as { id: number }).id,
      unionId,
      source: "v1",
      isFresh: true,
    })
    .returning({ id: allianceSnapshots.id });
  const id = (row as { id: number }).id;
  if (members.length > 0)
    await db
      .insert(memberSnapshots)
      .values(
        members.map(
          (m) => ({ ...m, allianceSnapshotId: id }) as typeof memberSnapshots.$inferInsert,
        ),
      );
  return id;
}

beforeAll(async () => {
  db = await openTestDb();
  withRanks = await alliance(1, [
    rank(10, 105, "R5"),
    rank(11, 104, "R4 · Diplomat"),
    rank(12, 104, "R4"),
    rank(13, 103, "R3"),
    rank(14, 104, "R4 · God of War"),
  ]);
  withoutRanks = await alliance(2, [{ uid: 20, name: "Old", power: 1, kills: 1, lv: 1 }]);
});

describe("rolesOf", () => {
  it("returns the R5 leader and each titled R4 with the title as the data gives it", async () => {
    const roles = (await rolesOf(db, [withRanks])).get(withRanks);
    expect([...(roles ?? [])]).toEqual([
      [10, { kind: "leader" }],
      [11, { kind: "officer", title: "Diplomat" }],
      [14, { kind: "officer", title: "God of War" }],
    ]);
  });

  it("returns nothing for a roster without rank data and nothing but the role for the rest", async () => {
    const all = await rolesOf(db, [withRanks, withoutRanks]);
    expect(all.has(withoutRanks)).toBe(false);
    expect(findBlockedKeys([...all.values()].map((m) => [...m]))).toEqual([]);
    expect(JSON.stringify([...all.values()].map((m) => [...m]))).not.toMatch(
      /avatar|rank_code|raw/,
    );
  });

  it("leaves an untitled R4 and lower ranks unmarked", () => {
    expect(roleOf(104, "R4")).toBeNull();
    expect(roleOf(103, "R3")).toBeNull();
  });
});

describe("playerHistory role", () => {
  it("gives a player the role of their latest sighting's alliance read, or none without rank data", async () => {
    expect((await playerHistory(db, 11))?.current.role).toEqual({
      kind: "officer",
      title: "Diplomat",
    });
    expect((await playerHistory(db, 20))?.current.role).toBeNull();
  });
});
