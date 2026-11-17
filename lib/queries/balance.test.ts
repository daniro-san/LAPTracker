import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { dailyReads, dailyRosters } from "../schema";
import { powerBalance } from "./balance";

const at = (day: string) => new Date(`${day}T08:01:00Z`);
const NOW = new Date("2026-11-16T12:00:00Z");

interface Row {
  day: string;
  unionId: number;
  might: number | null;
  members?: number;
  isFresh?: boolean;
  error?: string | null;
}

async function daily(db: Db, { day, unionId, might, members = 10, isFresh = true, error }: Row) {
  await db
    .insert(dailyReads)
    .values({ day, startedAt: at(day), status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    tag: `A${unionId}`,
    name: `Alliance ${unionId}`,
    memberCount: members,
    totalPower: might,
    sourceUpdatedAt: at(day),
    isFresh,
    error: error ?? null,
    memberUids: [],
    memberNames: [],
    memberPower: [],
    memberKills: [],
  });
}

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  // Two complete days: 25 each, then 40, 30, 20, 10.
  for (const unionId of [1, 2, 3, 4]) await daily(db, { day: "2026-11-09", unionId, might: 25 });
  for (const unionId of [1, 2, 3, 4])
    await daily(db, { day: "2026-11-12", unionId, might: 50 - unionId * 10 });
  // 15 Nov: alliance 4 is stale. 16 Nov: alliance 3 failed and alliance 4 was not read.
  await daily(db, { day: "2026-11-15", unionId: 1, might: 60 });
  await daily(db, { day: "2026-11-15", unionId: 2, might: 30 });
  await daily(db, { day: "2026-11-15", unionId: 3, might: 20 });
  await daily(db, { day: "2026-11-15", unionId: 4, might: 9999, isFresh: false });
  await daily(db, { day: "2026-11-16", unionId: 1, might: 50, members: 30 });
  await daily(db, { day: "2026-11-16", unionId: 2, might: 30 });
  await daily(db, { day: "2026-11-16", unionId: 3, might: 7777, error: "timeout" });
  // Older than the 90 days: no point, and an alliance read only then is not on the page.
  await daily(db, { day: "2026-06-01", unionId: 5, might: 1_000_000 });
});

describe("powerBalance", () => {
  it("takes each alliance's newest usable roster, greatest might first", async () => {
    const { alliances } = await powerBalance(db, NOW);
    expect(alliances.map((a) => [a.unionId, a.might, a.at.toISOString().slice(0, 10)])).toEqual([
      [1, 50, "2026-11-16"],
      [2, 30, "2026-11-16"],
      [3, 20, "2026-11-15"],
      [4, 10, "2026-11-12"],
    ]);
    expect(alliances[0]).toMatchObject({ tag: "A1", name: "Alliance 1", members: 30 });
  });

  it("the trend is the top share per complete day, and leaves out an incomplete day", async () => {
    const { trend } = await powerBalance(db, NOW);
    expect(trend.map((p) => p.day)).toEqual(["2026-11-09", "2026-11-12"]);
    expect(trend.map((p) => p.top)).toEqual([0.75, 0.9]);
    expect(trend.map((p) => p.total)).toEqual([100, 100]);
  });

  it("reads nothing older than 90 days", async () => {
    const { alliances } = await powerBalance(db, NOW);
    expect(alliances.map((a) => a.unionId)).not.toContain(5);
  });
});
