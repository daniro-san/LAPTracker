// daily_reads claims against PGlite (issue 625): each retry's claim stores the targets of the attempt it
// starts, which /admin/runs judges the day's problems on.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { dailyReads } from "../schema";
import { claimAutoRetry, claimDailyRead, reclaimDailyRead } from "./daily-reads";

const DAY = "2026-11-20";
const START = new Date("2026-11-21T01:37:00Z");
const LATER = new Date("2026-11-21T01:52:00Z");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  // The day's first read, of 67120001 only, fell short.
  await claimDailyRead(db, DAY, START, [67120001]);
  await db.update(dailyReads).set({ status: "partial" }).where(eq(dailyReads.day, DAY));
});

const storedTargets = async () =>
  (await db.select({ ids: dailyReads.targetIds }).from(dailyReads))[0]?.ids;

describe("a retry's claim (issue 625)", () => {
  it("/admin's Retry stores its own targets", async () => {
    expect(await reclaimDailyRead(db, DAY, LATER, LATER, [67120001, 67120002])).toBe(true);
    expect(await storedTargets()).toEqual([67120001, 67120002]);
  });

  it("the tick's automatic retry stores its own targets", async () => {
    expect(await claimAutoRetry(db, DAY, LATER, LATER, [67120001, 67120002])).toBe(true);
    expect(await storedTargets()).toEqual([67120001, 67120002]);
  });
});
