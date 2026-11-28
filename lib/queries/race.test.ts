import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { dailyReads, dailyRosters } from "../schema";
import { racePace, type Race } from "./race";

// Saturdays Nov 7, 14, 21 and 28; the newest read is Sunday Nov 29.
const SATURDAYS = ["2026-11-07", "2026-11-14", "2026-11-21", "2026-11-28"];
const TODAY = "2026-11-29";
const members = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);

async function daily(db: Db, day: string, unionId: number, might: number, uids: number[]) {
  await db
    .insert(dailyReads)
    .values({ day, startedAt: new Date(`${day}T08:00:00Z`), status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    tag: `A${unionId}`,
    name: `Alliance ${unionId}`,
    memberCount: uids.length,
    totalPower: might,
    sourceUpdatedAt: new Date(`${day}T08:01:00Z`),
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `m${u}`),
    memberPower: uids.map(() => 1),
    memberKills: uids.map(() => 1),
  });
}

/** One alliance's four Saturday reads (oldest first) and today's, all with the same members unless given. */
async function alliance(
  db: Db,
  id: number,
  mights: (number | null)[],
  today: number,
  last?: number[],
) {
  const uids = members(id * 100, 10);
  for (const [i, day] of SATURDAYS.entries()) {
    const might = mights[i];
    if (might !== null && might !== undefined)
      await daily(db, day, id, might, i === 3 && last ? last : uids);
  }
  await daily(db, TODAY, id, today, last ?? uids);
}

let race: Race | null;
beforeAll(async () => {
  const db = await openTestDb();
  // 1: weeks +10, +20, +5. 2: the greatest today but slow, +1 a week. 3: two left and two joined (40 %).
  // 4: one joined (10 %, not more). 5: no read on Nov 14.
  await alliance(db, 1, [100, 110, 130, 135], 140);
  await alliance(db, 2, [146, 147, 148, 149], 150);
  await alliance(db, 3, [50, 60, 70, 80], 90, [...members(302, 8), 901, 902]);
  await alliance(db, 4, [40, 41, 42, 43], 44, [...members(400, 10), 903]);
  await alliance(db, 5, [30, null, 32, 33], 34);
  race = await racePace(db);
});

const row = (id: number) => race?.rows.find((r) => r.unionId === id);

describe("racePace", () => {
  it("takes the median of the last three Saturday-to-Saturday changes, with the lowest and highest", () => {
    expect(race?.today).toBe(TODAY);
    expect([race?.from, race?.to]).toEqual(["2026-11-07", "2026-11-28"]);
    expect(row(1)).toMatchObject({ might: 140, pace: 10, low: 5, high: 20, projected: 180 });
  });

  it("leaves out an alliance whose membership moved more than 10 %", () => {
    expect(race?.left).toContainEqual({
      unionId: 3,
      tag: "A3",
      name: "Alliance 3",
      reason: "moved",
    });
    expect(row(4)).toMatchObject({ pace: 1 });
  });

  it("has no pace for an alliance without a read on every Saturday", () => {
    expect(race?.left).toContainEqual({ unionId: 5, tag: "A5", name: "Alliance 5", reason: "few" });
    expect(row(5)).toBeUndefined();
  });

  it("ranks today's might and the projected might among the alliances with a pace", () => {
    expect(race?.rows.map((r) => [r.unionId, r.rank, r.projectedRank])).toEqual([
      [2, 1, 2],
      [1, 2, 1],
      [4, 3, 3],
    ]);
  });
});

describe("racePace before any read", () => {
  it("is null", async () => {
    expect(await racePace(await openTestDb())).toBeNull();
  });
});
