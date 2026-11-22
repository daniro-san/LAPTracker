// /admin/runs' daily read problems (D67, D133): a "Get today's details" roster stored under the read's day
// is not one of the read's alliances, unless the read itself read that alliance later the same day.
import { beforeAll, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { dailyReads, dailyRosters, runLogs } from "../schema";
import { allianceLookups } from "../schema-alliances";
import { listDailyReads } from "./daily-runs";

const DAY = "2026-11-20";
const START = new Date("2026-11-21T01:30:00Z"); // Fri 23:30 ST: the daily read
const LOOKUP = new Date("2026-11-20T16:05:00Z"); // Fri 14:05 ST: a lookup's press
const [READ, LOOKED_UP, LOOKED_UP_THEN_READ] = [67120001, 67120002, 67120003];

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  await db.insert(dailyReads).values({ day: DAY, startedAt: START, status: "partial" });
  const row = {
    readDay: DAY,
    memberUids: [],
    memberNames: [],
    memberPower: [],
    memberKills: [],
  };
  await db.insert(dailyRosters).values([
    // Read by the daily read and stale; no line, as a read from before its lines were kept (#251).
    {
      ...row,
      unionId: READ,
      tag: "RD",
      isFresh: false,
      sourceUpdatedAt: new Date("2026-11-21T00:50:00Z"),
    },
    // The lookup's cached copy: fresh by its own 60-minute rule, hours older than the read's start.
    {
      ...row,
      unionId: LOOKED_UP,
      tag: "LK",
      isFresh: true,
      sourceUpdatedAt: new Date("2026-11-20T15:30:00Z"),
    },
    // Looked up in the day, then in the day's tracked set at 23:30: the read's stale roster replaced it.
    {
      ...row,
      unionId: LOOKED_UP_THEN_READ,
      tag: "LR",
      isFresh: false,
      sourceUpdatedAt: new Date("2026-11-21T00:40:00Z"),
    },
  ]);
  const claim = {
    day: DAY,
    claimedAt: LOOKUP,
    finishedAt: LOOKUP,
    status: "done" as const,
    callsUsed: 2,
  };
  await db.insert(allianceLookups).values([
    { ...claim, unionId: LOOKED_UP },
    { ...claim, unionId: LOOKED_UP_THEN_READ },
  ]);
  await db.insert(runLogs).values({
    readDay: DAY,
    at: START,
    level: "info",
    code: "v1.fetch",
    unionId: LOOKED_UP_THEN_READ,
    data: { endpoint: "alliance" },
  });
});

it("names only the read's own stale alliances, never a lookup's roster stored under its day (D133)", async () => {
  const [read] = await listDailyReads(db);

  expect(read?.problems.map((p) => p.unionId)).toEqual([READ, LOOKED_UP_THEN_READ]);
});
