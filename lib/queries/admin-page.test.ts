import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { dailyReads, runLogs } from "../schema";
import { morningQuota } from "./admin-page";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

/** The daily read's quota check as its run log writes it (`logFetch`, lib/daily-read.ts). */
const quotaLine = (readDay: string, at: string, remaining: number | null) => ({
  readDay,
  at: new Date(at),
  level: remaining === null ? ("warn" as const) : ("info" as const),
  code: "v1.fetch",
  data: { endpoint: "quota", union_id: null, quota_remaining: remaining },
});

describe("morningQuota (issue 585)", () => {
  it("is the daily read's first quota check, kept through a retry that read the quota after the day's spend", async () => {
    // Fri 20 Nov (server day): its read ran Sat 01:30 UTC with 960 left; a Retry at 14:30 UTC, after the
    // KvK's Before and After, read 819 and overwrote the row's quota_remaining_before and started_at.
    await db.insert(dailyReads).values([
      {
        day: "2026-11-19",
        startedAt: new Date("2026-11-20T01:30:00Z"),
        status: "complete",
        quotaRemainingBefore: 400,
      },
      {
        day: "2026-11-20",
        startedAt: new Date("2026-11-21T14:30:00Z"),
        status: "complete",
        quotaRemainingBefore: 819,
      },
    ]);
    await db.insert(runLogs).values([
      quotaLine("2026-11-19", "2026-11-20T01:30:02Z", 400),
      quotaLine("2026-11-20", "2026-11-21T01:30:02Z", 960),
      {
        ...quotaLine("2026-11-20", "2026-11-21T01:30:05Z", null),
        data: { endpoint: "alliance", union_id: 67111155, quota_remaining: 958 },
      },
      quotaLine("2026-11-20", "2026-11-21T14:30:02Z", 819),
    ]);
    expect(await morningQuota(db)).toEqual({
      remaining: 960,
      at: new Date("2026-11-21T01:30:02Z"),
    });
  });

  it("gives no number when the day's first quota check got none, even if a retry's later did", async () => {
    await db.insert(dailyReads).values({
      day: "2026-11-20",
      startedAt: new Date("2026-11-21T14:30:00Z"),
      status: "complete",
      quotaRemainingBefore: 819,
    });
    await db
      .insert(runLogs)
      .values([
        quotaLine("2026-11-20", "2026-11-21T01:30:02Z", null),
        quotaLine("2026-11-20", "2026-11-21T14:30:02Z", 819),
      ]);
    expect((await morningQuota(db))?.remaining).toBeNull();
  });

  it("takes no retry's check for the first read's, when the first read's check was cut and left no line", async () => {
    await db.insert(dailyReads).values({
      day: "2026-11-20",
      startedAt: new Date("2026-11-21T14:30:00Z"),
      status: "complete",
      quotaRemainingBefore: 819,
    });
    // The first read: its start line, then the deadline; its quota call never answered, so no v1.fetch line.
    const line = (at: string, code: string, level: "info" | "warn") => ({
      readDay: "2026-11-20",
      at: new Date(at),
      level,
      code,
      data: {},
    });
    await db
      .insert(runLogs)
      .values([
        line("2026-11-21T01:30:00Z", "daily.start", "info"),
        line("2026-11-21T01:31:40Z", "run.deadline", "warn"),
        quotaLine("2026-11-20", "2026-11-21T14:30:02Z", 819),
      ]);
    expect(await morningQuota(db)).toBeNull();
  });
});
