import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../../config/alliances";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { dailyReads, runLogs, workspaces } from "../schema";
import { squadQueue, squadReads } from "../schema-squads";
import { squadsProgress } from "./squads-progress";

const DAY = "2026-11-19";
const NOW = new Date("2026-11-20T15:00:00Z");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

describe("squadsProgress (D132)", () => {
  it("counts the queue's members read, waiting to retry and not read, the next try, a batch holding the day and the last batch", async () => {
    await db
      .insert(workspaces)
      .values({ unionId: OWN_ALLIANCE_ID, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
    await db
      .insert(dailyReads)
      .values({ day: DAY, startedAt: NOW, status: "complete", quotaRemainingBefore: 900 });
    await db.insert(squadReads).values({
      day: DAY,
      unionId: OWN_ALLIANCE_ID,
      status: "running",
      startedAt: NOW,
      batchAt: new Date(NOW.getTime() - 30_000),
      members: 4,
      callsUsed: 6,
      failed: 4,
      quotaRemaining: 870,
    });
    const next = new Date(NOW.getTime() + 600_000);
    const q = { day: DAY, unionId: OWN_ALLIANCE_ID, dueAt: NOW };
    await db.insert(squadQueue).values([
      { ...q, uid: 10, state: "done", attempts: 1 },
      { ...q, uid: 20, state: "done", attempts: 2 },
      { ...q, uid: 30, attempts: 1, dueAt: next },
      { ...q, uid: 40, state: "failed", attempts: 3 },
      // Joined during the day, not read yet.
      { ...q, uid: 50 },
    ]);
    const at = new Date(NOW.getTime() - 3_600_000);
    await db.insert(runLogs).values({
      readDay: DAY,
      at,
      level: "info",
      code: "squads.batch",
      data: { workspace: "ogs", calls: 3 },
    });

    expect(await squadsProgress(db, DAY, NOW)).toEqual([
      {
        unionId: OWN_ALLIANCE_ID,
        status: "running",
        read: 2,
        members: 5,
        retrying: 1,
        waiting: 2,
        dueNow: 1,
        failed: 1,
        nextAt: next,
        quotaRemaining: 870,
        reason: null,
        batchRunning: true,
        lastBatchAt: at,
      },
    ]);
  });
});
