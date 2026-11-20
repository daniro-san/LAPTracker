import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../../config/alliances";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { dailyReads, dailyRosters, runLogs, workspaces } from "../schema";
import { squadReads } from "../schema-squads";
import { squadsProgress } from "./squads-progress";

const DAY = "2026-11-19";
const NOW = new Date("2026-11-20T15:00:00Z");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

describe("squadsProgress", () => {
  it("counts the members up to the cursor, the retries waiting, a batch holding the day and the last batch", async () => {
    await db
      .insert(workspaces)
      .values({ unionId: OWN_ALLIANCE_ID, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
    await db
      .insert(dailyReads)
      .values({ day: DAY, startedAt: NOW, status: "complete", quotaRemainingBefore: 900 });
    await db.insert(dailyRosters).values({
      readDay: DAY,
      unionId: OWN_ALLIANCE_ID,
      memberCount: 4,
      isFresh: true,
      memberUids: [10, 20, 30, 40],
      memberNames: ["P1", "P2", "P3", "P4"],
      memberPower: [1, 1, 1, 1],
      memberKills: [0, 0, 0, 0],
    });
    await db.insert(squadReads).values({
      day: DAY,
      unionId: OWN_ALLIANCE_ID,
      status: "running",
      startedAt: NOW,
      batchAt: new Date(NOW.getTime() - 30_000),
      members: 4,
      afterUid: 30,
      retryUids: [20],
      callsUsed: 3,
      failed: 1,
      quotaRemaining: 870,
    });
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
        reached: 3,
        members: 4,
        retrying: 1,
        failed: 1,
        quotaRemaining: 870,
        reason: null,
        batchRunning: true,
        lastBatchAt: at,
      },
    ]);
  });
});
