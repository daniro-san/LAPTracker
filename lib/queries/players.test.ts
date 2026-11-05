import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import { findBlockedKeys } from "./blocked-keys";
import { playerHistory, searchPlayers } from "./players";

// A raw_json that carries every blocked key, as a real /v1 roster does (plan §12.1).
const rawJson = {
  members: [
    { uid: 7, x: 1, y: 2, online: true, last_online_at: "t", joined_at: "t", daily_honor: 1 },
  ],
};

let db: Db;

beforeAll(async () => {
  db = await openTestDb();
  const at = new Date("2026-10-17T14:00:00Z");
  const [event] = await db
    .insert(events)
    .values({ name: "Saturday", eventAtUtc: at, allianceIds: [1], beforeAt: at, afterAt: at })
    .returning({ id: events.id });
  for (const phase of ["before", "after"] as const) {
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId: (event as { id: number }).id, phase, startedAt: at, status: "complete" })
      .returning({ id: snapshots.id });
    const [alliance] = await db
      .insert(allianceSnapshots)
      .values({
        snapshotId: (snap as { id: number }).id,
        unionId: 1,
        tag: "OGs",
        name: "Old Grandmas",
        source: "v1",
        isFresh: true,
        rawJson,
      })
      .returning({ id: allianceSnapshots.id });
    await db.insert(memberSnapshots).values({
      allianceSnapshotId: (alliance as { id: number }).id,
      uid: 7,
      name: phase === "before" ? "Nana" : "Nana Prime",
      power: 10,
      kills: 5,
      lv: 3,
    });
  }
});

describe("player read models (plan §12.1)", () => {
  it("returns no blocked roster key from playerHistory or searchPlayers", async () => {
    const history = await playerHistory(db, 7);
    const matches = await searchPlayers(db, "nana");
    expect(history?.rows).toHaveLength(1);
    expect(matches.map((m) => m.uid)).toEqual([7]);
    expect(findBlockedKeys(history)).toEqual([]);
    expect(findBlockedKeys(matches)).toEqual([]);
  });

  it("matches case-insensitively and treats % in the search text as a literal", async () => {
    const [match] = await searchPlayers(db, "NANA");
    expect(match?.name).toBe("Nana Prime");
    expect(await searchPlayers(db, "Nana%")).toEqual([]);
  });
});
