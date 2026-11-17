import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { dailyReads, dailyRosters } from "../schema";
import { allianceStanding } from "./standing";

const NOW = new Date("2026-11-16T12:00:00Z");

async function daily(
  db: Db,
  day: string,
  unionId: number,
  might: number,
  state: { isFresh?: boolean; error?: string } = {},
) {
  await db
    .insert(dailyReads)
    .values({ day, startedAt: new Date(`${day}T08:00:00Z`), status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    tag: `A${unionId}`,
    name: `Alliance ${unionId}`,
    memberCount: 10,
    totalPower: might,
    sourceUpdatedAt: new Date(`${day}T08:01:00Z`),
    isFresh: state.isFresh ?? true,
    error: state.error ?? null,
    memberUids: [],
    memberNames: [],
    memberPower: [],
    memberKills: [],
  });
}

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  for (const [id, might] of [
    [1, 40],
    [2, 30],
  ] as const)
    await daily(db, "2026-11-09", id, might);
  // 12 Nov: alliance 2 is stale, so the day is no rank series. 16 Nov: both read, 2 now ahead.
  await daily(db, "2026-11-12", 1, 41);
  await daily(db, "2026-11-12", 2, 9999, { isFresh: false });
  await daily(db, "2026-11-16", 1, 44);
  await daily(db, "2026-11-16", 2, 45);
});

describe("allianceStanding", () => {
  it("ranks the alliances over the complete days and skips a day with a stale roster", async () => {
    const s = await allianceStanding(db, NOW);
    expect(s?.days).toEqual(["2026-11-09", "2026-11-16"]);
    expect(s?.rows.map((r) => [r.unionId, r.rank, r.move, r.might])).toEqual([
      [2, 1, 1, 45],
      [1, 2, -1, 44],
    ]);
    expect(s?.serverMight).toBe(89);
  });
});
