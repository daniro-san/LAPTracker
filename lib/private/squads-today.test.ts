// Alliance settings' "Squads today" (D132) against PGlite: a running day says when the next try comes; a
// day stopped by the tracker says why, and offers no next try.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { TEST_ENV } from "../app-context.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { dailyReads } from "../schema";
import { squadQueue, squadReads } from "../schema-squads";
import { squadsToday } from "./squads-today";

/** Friday 13:00 server time (UTC−2): Thursday's daily read is the quota day's. */
const NOW = new Date("2026-11-20T15:00:00Z");
const DAY = "2026-11-19";
const UNION = 900001;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db.insert(dailyReads).values({ day: DAY, startedAt: NOW, status: "complete" });
  const later = new Date(NOW.getTime() + 600_000);
  const q = { day: DAY, unionId: UNION, dueAt: NOW };
  await db.insert(squadQueue).values([
    { ...q, uid: 1, state: "done", attempts: 1 },
    { ...q, uid: 2, attempts: 1, dueAt: later },
  ]);
});

const day = (status: "running" | "stopped", reason: string | null) =>
  db
    .insert(squadReads)
    .values({ day: DAY, unionId: UNION, status, reason, startedAt: NOW, members: 2 });

describe("squadsToday (D132)", () => {
  it("gives the next try while the day runs", async () => {
    await day("running", null);
    expect(await squadsToday(db, { unionId: UNION }, TEST_ENV, NOW, "own")).toMatchObject({
      read: 1,
      members: 2,
      retrying: 1,
      nextAt: new Date(NOW.getTime() + 600_000),
      stopped: null,
    });
  });

  it("says why a stopped day stopped, with no next try", async () => {
    await day("stopped", "key_invalid");
    expect(await squadsToday(db, { unionId: UNION }, TEST_ENV, NOW, "own")).toMatchObject({
      read: 1,
      nextAt: null,
      stopped: "key",
    });
  });
});
