// rosterSightings reads one player's rows with `@>`, which the member_uids GIN index serves (issue 521): the
// same rows, in the same order, as the `= any` it replaced.
import { and, asc, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { dailyRosters } from "../schema";
import { dailyFit } from "./history-readings";
import { rosterSightings } from "./roster-stays";

const roster = (readDay: string, unionId: number, uids: number[], more = {}) => ({
  readDay,
  unionId,
  memberCount: uids.length,
  isFresh: true,
  memberUids: uids,
  memberNames: uids.map((u) => `P${u}`),
  memberPower: uids.map(() => 100),
  memberKills: uids.map(() => 5),
  ...more,
});

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});

describe("rosterSightings (issue 521)", () => {
  it("returns the rows `= any` returned: usable rosters listing the player, oldest first", async () => {
    await db
      .insert(dailyRosters)
      .values([
        roster("2026-11-03", 2, [7, 8]),
        roster("2026-11-01", 1, [7, 9]),
        roster("2026-11-02", 1, [9]),
        roster("2026-11-02", 3, [7], { isFresh: false }),
        roster("2026-11-04", 1, [7], { error: "timeout" }),
        roster("2026-11-01", 2, [8, 7]),
      ]);
    const before = await db
      .select({ day: dailyRosters.readDay, unionId: dailyRosters.unionId })
      .from(dailyRosters)
      .where(and(dailyFit, sql`${7} = any(${dailyRosters.memberUids})`))
      .orderBy(asc(dailyRosters.readDay), asc(dailyRosters.unionId));

    expect(await rosterSightings(db, 7)).toEqual(before);
    expect(before).toEqual([
      { day: "2026-11-01", unionId: 1 },
      { day: "2026-11-01", unionId: 2 },
      { day: "2026-11-03", unionId: 2 },
    ]);
  });
});
