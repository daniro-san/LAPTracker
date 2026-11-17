import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { dailyReads, dailyRosters } from "../schema";
import { defaultPeriod, flowPage } from "./flow";

let db: Db;
const NOW = new Date("2026-11-16T12:00:00Z");
const TRACKED = [1, 2, 3];
const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);

async function daily(
  day: string,
  unionId: number,
  uids: number[],
  o: { fresh?: boolean; error?: string | null } = {},
) {
  const startedAt = new Date(`${day}T08:01:00Z`);
  await db.insert(dailyReads).values({ day, startedAt, status: "complete" }).onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    tag: `T${unionId}`,
    name: `Alliance ${unionId}`,
    memberCount: uids.length,
    totalPower: 0,
    sourceUpdatedAt: new Date(startedAt.getTime() + unionId * 1000),
    isFresh: o.fresh ?? true,
    error: o.error ?? null,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map(() => 0),
    memberKills: uids.map(() => 0),
  });
}

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

describe("flowPage", () => {
  it("shows only cells of 5 or more, and leaves the hidden ones out of the totals and the row order", async () => {
    // Alliance 1: 12 members; on the end day 6 are in 2, 4 in 3 (hidden), 1 left, 1 stayed.
    await daily("2026-11-07", 1, range(100, 12));
    await daily("2026-11-07", 2, range(200, 3));
    await daily("2026-11-07", 3, range(300, 2));
    await daily("2026-11-16", 1, [111]);
    await daily("2026-11-16", 2, [...range(100, 6), ...range(200, 3), ...range(400, 5)]);
    await daily("2026-11-16", 3, [...range(106, 4), 300, 301]);
    const { flow, period } = await flowPage(
      db,
      NOW,
      { from: "2026-11-07", to: "2026-11-16" },
      TRACKED,
    );
    expect(period).toEqual({ from: "2026-11-07", to: "2026-11-16" });
    expect(flow?.cells).toContainEqual({ from: 1, to: 2, n: 6 });
    expect(flow?.cells).toContainEqual({ from: null, to: 2, n: 5 });
    expect(flow?.cells.every((c) => c.n >= 5)).toBe(true);
    // The 4 who went to 3 and the 1 who left are hidden: counted nowhere, so they cannot be subtracted out.
    expect([flow?.moved, flow?.arrived, flow?.left]).toEqual([6, 5, 0]);
    // By every move, 1 and 2 tie at 11 and 1 comes first; by the moves shown, 2 (11) leads 1 (6).
    expect(flow?.alliances.map((a) => a.unionId)).toEqual([2, 1, 3]);
    expect(flow?.largest).toEqual({ from: 1, to: 2, n: 6 });
  });

  it("leaves out an alliance without a usable read on both days and names it", async () => {
    await daily("2026-11-07", 1, range(100, 6));
    await daily("2026-11-07", 2, range(200, 6), { fresh: false });
    await daily("2026-11-16", 1, range(100, 6));
    await daily("2026-11-16", 2, range(200, 6));
    const { flow } = await flowPage(db, NOW, { from: "2026-11-07", to: "2026-11-16" }, TRACKED);
    expect(flow?.alliances.map((a) => a.unionId)).toEqual([1]);
    expect(flow?.notCounted.map((a) => a.unionId)).toEqual([2]);
  });

  it("places a member who is in two rosters on one day with the roster read later", async () => {
    await daily("2026-11-07", 1, range(100, 5));
    await daily("2026-11-16", 1, range(100, 5));
    await daily("2026-11-16", 2, range(100, 5)); // read 1 s later than alliance 1's
    await daily("2026-11-07", 2, range(500, 1));
    const { flow } = await flowPage(db, NOW, { from: "2026-11-07", to: "2026-11-16" }, TRACKED);
    expect(flow?.cells).toEqual([{ from: 1, to: 2, n: 5 }]);
  });

  it("offers the days with a usable read, and defaults to the newest and the read a week before it", async () => {
    for (const day of ["2026-11-02", "2026-11-08", "2026-11-09", "2026-11-16"]) {
      await daily(day, 1, [1]);
    }
    await daily("2026-11-15", 1, [1], { error: "boom" });
    const page = await flowPage(db, NOW, null, TRACKED);
    expect(page.days).toEqual(["2026-11-16", "2026-11-09", "2026-11-08", "2026-11-02"]);
    expect(page.period).toEqual({ from: "2026-11-09", to: "2026-11-16" });
  });

  it("shows no flow for two days that are not in order", async () => {
    await daily("2026-11-07", 1, [1]);
    await daily("2026-11-16", 1, [1]);
    const page = await flowPage(db, NOW, { from: "2026-11-16", to: "2026-11-16" }, TRACKED);
    expect(page.flow).toBeNull();
  });
});

describe("defaultPeriod", () => {
  it("falls back to the oldest day when no read is a week old, and to nothing for a single day", () => {
    expect(defaultPeriod(["2026-11-16", "2026-11-14"])).toEqual({
      from: "2026-11-14",
      to: "2026-11-16",
    });
    expect(defaultPeriod(["2026-11-16"])).toBeNull();
  });
});
