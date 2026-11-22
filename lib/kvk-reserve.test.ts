// The KvK opponent's part of the reserves outside a run (D152): only on the KvK's quota day, only with an
// opponent saved, and the calls still due. Invented tags of an invented server 326; PGlite.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { noQueryDb, openTestDb, truncateAll } from "./db.test-helpers";
import { opponentReserve } from "./kvk-reserve";
import { insertOpponentRead, saveOpponent } from "./repo/kvk";
import { kvkOpponents } from "./schema-kvk";
import { squadsReserve } from "./squads";

// Server time is UTC−2; the KvK is Saturday 2026-11-21, 12:00 ST (14:00 UTC).
const CFG = { ...TEST_ENV, SAMPLE_EVERY_MIN: 15 };
const WAR = new Date("2026-11-21T14:00:00Z"); // Sat 12:00 ST
const FRI_NIGHT = new Date("2026-11-21T01:39:00Z"); // Fri 23:39 ST = Saturday UTC, the KvK's quota day
const THU_NIGHT = new Date("2026-11-20T01:39:00Z"); // Thu 23:39 ST

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

describe("opponentReserve (D152)", () => {
  it("leaves the reserves unchanged on a KvK day with no opponent saved", async () => {
    const calls = await opponentReserve(db, FRI_NIGHT, CFG);
    expect(calls).toBe(0);
    expect(squadsReserve(FRI_NIGHT, CFG, 20, calls)).toBe(squadsReserve(FRI_NIGHT, CFG, 20));
  });

  it("keeps two calls per tag before the Start, and asks the database nothing on another day", async () => {
    await saveOpponent(db, { eventAt: WAR, server: 326, tags: ["AAA", "BBB", "CCC"] }, THU_NIGHT);
    expect(await opponentReserve(db, FRI_NIGHT, CFG)).toBe(6);
    expect(await opponentReserve(noQueryDb, THU_NIGHT, CFG)).toBe(0);
  });

  it("keeps only the End reads still due once the Start has read", async () => {
    await saveOpponent(db, { eventAt: WAR, server: 326, tags: ["AAA", "BBB"] }, THU_NIGHT);
    const [o] = await db.select({ id: kvkOpponents.id }).from(kvkOpponents);
    const row = {
      opponentId: o?.id ?? 0,
      phase: "before" as const,
      unionId: 7,
      sid: 326,
      name: "Enemy",
      memberCount: 1,
      totalPower: 1,
      totalKills: 1,
      memberUids: [1],
      memberPower: [1],
      memberKills: [1],
      sourceUpdatedAt: new Date("2026-11-21T12:01:00Z"),
      cached: false,
      isFresh: true,
      error: null,
      readAt: new Date("2026-11-21T12:01:00Z"), // Sat 10:01 ST
    };
    await db.execute(
      "insert into events (name, event_at_utc, alliance_ids, before_at, after_at) values ('e', now(), '{}', now(), now())",
    );
    const snapshotId = await firstSnapshot();
    await insertOpponentRead(db, { ...row, snapshotId, tag: "AAA" });
    await insertOpponentRead(db, {
      ...row,
      snapshotId,
      tag: "BBB",
      unionId: null,
      error: "not found",
    });
    // AAA's End is due; BBB failed at the Start, so nothing more is due for it.
    expect(await opponentReserve(db, new Date("2026-11-21T13:00:00Z"), CFG)).toBe(1);
  });
});

/** A snapshot row for the reads' foreign key. */
async function firstSnapshot(): Promise<number> {
  const result = await db.execute<{ id: number }>(
    "insert into snapshots (event_id, phase, started_at, status) select id, 'before', now(), 'complete' from events limit 1 returning id",
  );
  return Number(result.rows[0]?.id);
}
