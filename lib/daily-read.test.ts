import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ago, fakeV1, IDS, minutes, roster, T0 } from "./collector.test-helpers";
import { runDailyRead } from "./daily-read";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { dailyReads, dailyRosters } from "./schema";
import { UpstreamError } from "./sources/types";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

const deps = (v1: ReturnType<typeof fakeV1>) => ({ v1, now: () => T0 });

describe("runDailyRead (D60)", () => {
  it("reads no roster when the quota would not leave an event run its reserve", async () => {
    // 2 alliances need requiredQuota(2) + requiredQuota(20) = 14 + 50 = 64.
    const v1 = fakeV1((id) => roster(id, ago(T0, minutes(1))), 63);

    const summary = await runDailyRead(deps(v1), db, "2026-11-10", IDS.slice(0, 2));

    expect(v1.calls).toEqual([]);
    expect(summary).toMatchObject({ status: "failed", callsUsed: 1 });
    expect(summary?.error).toBe("quota: remaining 63 < required 64");
    expect(await db.select().from(dailyRosters)).toEqual([]);
  });

  it("stores an error row for a failed alliance and closes the read partial, once per day", async () => {
    const [ok = 0, bad = 0] = IDS;
    const v1 = fakeV1((id) =>
      id === bad ? new UpstreamError(503) : roster(id, ago(T0, minutes(1))),
    );

    const summary = await runDailyRead(deps(v1), db, "2026-11-10", [ok, bad]);
    const again = await runDailyRead(deps(v1), db, "2026-11-10", [ok, bad]);

    expect(summary).toMatchObject({ status: "partial", callsUsed: 3 });
    expect(summary?.failed).toEqual([
      { unionId: bad, tag: expect.any(String), error: "v1 http 503" },
    ]);
    expect(again).toBeNull();
    const rows = await db.select().from(dailyRosters).orderBy(dailyRosters.id);
    expect(rows.map((r) => [r.unionId, r.error, r.memberUids.length])).toEqual(
      expect.arrayContaining([
        [ok, null, 3],
        [bad, "v1 http 503", 0],
      ]),
    );
    expect(await db.select({ status: dailyReads.status }).from(dailyReads)).toEqual([
      { status: "partial" },
    ]);
  });
});
