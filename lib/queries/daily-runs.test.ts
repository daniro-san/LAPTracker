// /admin/runs' daily read problems (D67, D133): a "Get today's details" roster stored under the read's day
// is not one of the read's alliances, unless that alliance was one of the read's targets: in the day's
// tracked set, or read by the read (its run_logs line), as a workspace's alliance is.
import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { dailyReads, dailyRosters, runLogs } from "../schema";
import { allianceLookups, trackedSets } from "../schema-alliances";
import { listDailyReads } from "./daily-runs";

const [READ, LOOKED_UP, WORKSPACE, JOINED_SET, FAILED] = [
  67120001, 67120002, 67120003, 67120004, 67120005,
];
const empty = { memberUids: [], memberNames: [], memberPower: [], memberKills: [] };

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});

/** A daily read of `day` started at `start`, its tracked set, its rows, lookup claims and lines. */
async function seed(
  day: string,
  start: Date,
  parts: {
    tracked: number[];
    /** The latest attempt's targets (issue 625); left out, the day was read before it. */
    targets?: number[];
    rows: (Partial<typeof dailyRosters.$inferInsert> & { unionId: number; isFresh: boolean })[];
    lookups: { unionId: number; status: "done" | "failed"; at: Date }[];
    lines: number[];
  },
) {
  await db
    .insert(dailyReads)
    .values({ day, startedAt: start, status: "partial", targetIds: parts.targets ?? null });
  await db
    .insert(trackedSets)
    .values({ day, allianceIds: parts.tracked, source: "board", createdAt: start });
  await db.insert(dailyRosters).values(parts.rows.map((r) => ({ ...empty, ...r, readDay: day })));
  if (parts.lookups.length > 0)
    await db.insert(allianceLookups).values(
      parts.lookups.map((l) => ({
        unionId: l.unionId,
        day,
        claimedAt: l.at,
        finishedAt: l.at,
        status: l.status,
        callsUsed: 2,
      })),
    );
  for (const unionId of parts.lines)
    await db.insert(runLogs).values({
      readDay: day,
      at: start,
      level: unionId === FAILED ? "warn" : "info",
      code: "v1.fetch",
      unionId,
      data: { endpoint: "alliance" },
    });
}

const problemsOf = async (day: string) =>
  (await listDailyReads(db)).find((r) => r.day === day)?.problems ?? [];

describe("a daily read's problems on /admin/runs (D133)", () => {
  beforeAll(async () => {
    // Fri 2026-11-20, read at 23:30 ST (01:30 UTC on the 21st).
    await seed("2026-11-20", new Date("2026-11-21T01:30:00Z"), {
      tracked: [READ],
      rows: [
        // Read by the read and stale.
        { unionId: READ, isFresh: false, sourceUpdatedAt: new Date("2026-11-21T00:50:00Z") },
        // A lookup's cached copy at 14:05 ST: fresh by its own 60-minute rule, hours older than the read.
        { unionId: LOOKED_UP, isFresh: true, sourceUpdatedAt: new Date("2026-11-20T15:30:00Z") },
        // Looked up, then a workspace's alliance outside the set the read read on its key, stale.
        { unionId: WORKSPACE, isFresh: false, sourceUpdatedAt: new Date("2026-11-21T00:40:00Z") },
      ],
      lookups: [
        { unionId: LOOKED_UP, status: "done", at: new Date("2026-11-20T16:05:00Z") },
        { unionId: WORKSPACE, status: "done", at: new Date("2026-11-20T16:05:00Z") },
      ],
      lines: [READ, WORKSPACE],
    });
    // Thu 2026-11-19, read at 23:30 ST: JOINED_SET was looked up at 14:05 ST, then entered the day's set;
    // the read stopped (a 429) before reaching it, so it has no line and keeps the lookup's roster.
    await seed("2026-11-19", new Date("2026-11-20T01:30:00Z"), {
      tracked: [JOINED_SET],
      rows: [
        { unionId: JOINED_SET, isFresh: true, sourceUpdatedAt: new Date("2026-11-19T15:30:00Z") },
      ],
      lookups: [{ unionId: JOINED_SET, status: "done", at: new Date("2026-11-19T16:05:00Z") }],
      lines: [],
    });
    // Wed 2026-11-18, read at 23:30 ST: FAILED's lookup failed at 14:05 ST, it entered the day's set and
    // the read's call failed too: the read's error row.
    await seed("2026-11-18", new Date("2026-11-19T01:30:00Z"), {
      tracked: [FAILED],
      rows: [{ unionId: FAILED, isFresh: false, error: "v1 http 503" }],
      lookups: [{ unionId: FAILED, status: "failed", at: new Date("2026-11-18T16:05:00Z") }],
      lines: [FAILED],
    });
    // Sat 2026-11-21, read at 23:30 ST with its targets stored (issue 625): LOOKED_UP is not one of them, and
    // its lookup's roster is stale.
    await seed("2026-11-21", new Date("2026-11-22T01:30:00Z"), {
      tracked: [READ],
      targets: [READ],
      rows: [
        { unionId: LOOKED_UP, isFresh: false, sourceUpdatedAt: new Date("2026-11-21T15:30:00Z") },
      ],
      lookups: [{ unionId: LOOKED_UP, status: "done", at: new Date("2026-11-21T16:05:00Z") }],
      lines: [],
    });
  });

  it("names no looked-up alliance outside the targets the read stored", async () => {
    expect(await problemsOf("2026-11-21")).toEqual([]);
  });

  it("names the read's own stale alliances, never a lookup's roster of an alliance it did not read", async () => {
    expect((await problemsOf("2026-11-20")).map((p) => p.unionId)).toEqual([READ, WORKSPACE]);
  });

  it("still names a looked-up alliance in the day's tracked set that the read stopped before reaching", async () => {
    expect((await problemsOf("2026-11-19")).map((p) => [p.unionId, p.failed])).toEqual([
      [JOINED_SET, false],
    ]);
  });

  it("still names a looked-up alliance whose read failed", async () => {
    expect((await problemsOf("2026-11-18")).map((p) => [p.unionId, p.failed])).toEqual([
      [FAILED, true],
    ]);
  });
});
