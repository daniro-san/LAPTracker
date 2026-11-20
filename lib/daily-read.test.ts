import { readFileSync } from "node:fs";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ago, fakeV1, IDS, minutes, roster, T0 } from "./collector.test-helpers";
import { autoRetryDailyRead, runDailyRead } from "./daily-read";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { BLOCKED_ROSTER_KEYS, findBlockedKeys, memberHistoryCard } from "./queries";
import { dailyReads, dailyRosters, playerFrames } from "./schema";
import { alliances } from "./schema-alliances";
import { UpstreamError } from "./sources/types";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

const deps = (v1: ReturnType<typeof fakeV1>) => ({ v1, now: () => T0 });

/** Every alliance on LAP_API_KEY: no workspace key (D133's targets). */
const ours = (ids: number[]) => ids.map((unionId) => ({ unionId, key: null }));

describe("runDailyRead (D60)", () => {
  it("reads no roster when the quota would not leave an event run its reserve", async () => {
    // 2 alliances need requiredQuota(2) + requiredQuota(20) = 14 + 50 = 64.
    const v1 = fakeV1((id) => roster(id, ago(T0, minutes(1))), 63);

    const summary = await runDailyRead(deps(v1), db, "2026-11-10", ours(IDS.slice(0, 2)));

    expect(v1.calls).toEqual([]);
    expect(summary).toMatchObject({ status: "failed", callsUsed: 1 });
    expect(summary?.error).toBe("quota: remaining 63 < required 64");
    expect(await db.select().from(dailyRosters)).toEqual([]);
  });

  it("stores an error row for a failed alliance and closes the read partial, once per day", async () => {
    const [ok = 0, bad = 0] = IDS;
    // D133: a failed row is named by the alliance's newest label.
    const seen = { firstSeenDay: "2026-11-09", lastSeenDay: "2026-11-09" };
    await db.insert(alliances).values({ unionId: bad, tag: "BAD", name: "Bad Example", ...seen });
    const v1 = fakeV1((id) =>
      id === bad ? new UpstreamError(503) : roster(id, ago(T0, minutes(1))),
    );

    const summary = await runDailyRead(deps(v1), db, "2026-11-10", ours([ok, bad]));
    const again = await runDailyRead(deps(v1), db, "2026-11-10", ours([ok, bad]));

    expect(summary).toMatchObject({ status: "partial", callsUsed: 3 });
    expect(summary?.failed).toEqual([{ unionId: bad, tag: "BAD", error: "v1 http 503" }]);
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

  it("keeps each member's frame as the player's current one, unless a newer read already set it (D65)", async () => {
    const [id = 0] = IDS;
    const read = async (day: string, at: Date, frameId: number) => {
      const r = roster(id, at);
      const members = r.members.map((m) => ({ ...m, frameId }));
      await runDailyRead(deps(fakeV1(() => ({ ...r, members }))), db, day, ours([id]));
    };
    const frames = async () =>
      (await db.select().from(playerFrames).orderBy(playerFrames.uid)).map((f) => f.frameId);

    await read("2026-11-10", ago(T0, minutes(30)), 5001);
    expect(await frames()).toEqual([5001, 5001, 5001]);
    await read("2026-11-11", ago(T0, minutes(1)), 5010);
    expect(await frames()).toEqual([5010, 5010, 5010]);
    await read("2026-11-12", ago(T0, minutes(60)), 5026);
    expect(await frames()).toEqual([5010, 5010, 5010]);
  });
  it("keeps every roster field in raw_json, and the member history card serves none of the blocked keys (D72)", async () => {
    const [id = 0] = IDS;
    const raw: unknown = JSON.parse(
      readFileSync(
        join(import.meta.dirname, "../fixtures/v1-20261116T105019Z/alliance-67111155.json"),
        "utf8",
      ),
    );
    const at = ago(T0, minutes(1));
    await runDailyRead(deps(fakeV1(() => roster(id, at, { raw }))), db, "2026-11-10", ours([id]));

    const [row] = await db
      .select({ rawJson: dailyRosters.rawJson })
      .from(dailyRosters)
      .where(eq(dailyRosters.unionId, id));
    const stored = new Set(findBlockedKeys(row?.rawJson).map((p) => p.split(".").at(-1)));
    for (const key of BLOCKED_ROSTER_KEYS) expect(stored).toContain(key);
    const card = await memberHistoryCard(db, id, at);
    expect(card?.roster).toHaveLength(3);
    expect(findBlockedKeys(card)).toEqual([]);
  });
});

describe("autoRetryDailyRead (D72)", () => {
  const [kept = 0, bad = 0] = IDS;
  const day = "2026-11-10";
  /** The read at `T0` (23:37) fails `bad` and keeps `kept`'s roster, 15 minutes old then. */
  async function shortRead(badFailsAfter: boolean) {
    const clock = { now: T0 };
    const v1 = fakeV1((id) =>
      id === kept
        ? roster(id, ago(T0, minutes(15)))
        : clock.now === T0 || badFailsAfter
          ? new UpstreamError(503)
          : roster(id, ago(clock.now, minutes(1))),
    );
    const d = { v1, now: () => clock.now };
    expect(await runDailyRead(d, db, day, ours([kept, bad]))).toMatchObject({ status: "partial" });
    return { clock, v1, d };
  }

  it("judges the rosters it kept against the start of the read it completes, not its own", async () => {
    const { clock, v1, d } = await shortRead(false);
    clock.now = new Date(T0.getTime() + minutes(15));

    const summary = await autoRetryDailyRead(d, db, day, ours([kept, bad]));

    expect(v1.calls.slice(-1)).toEqual([bad]);
    expect(summary).toMatchObject({ status: "complete", stale: [], failed: [] });
  });

  it("runs once per day: a second automatic retry after one is recorded reads nothing", async () => {
    const { clock, v1, d } = await shortRead(true);
    clock.now = new Date(T0.getTime() + minutes(15));
    expect(await autoRetryDailyRead(d, db, day, ours([kept, bad]))).toMatchObject({
      status: "partial",
    });
    const calls = v1.calls.length;
    clock.now = new Date(T0.getTime() + minutes(30));

    expect(await autoRetryDailyRead(d, db, day, ours([kept, bad]))).toBeNull();
    expect(v1.calls).toHaveLength(calls);
  });

  it("reads nothing less than 10 minutes after the read started", async () => {
    const { clock, v1, d } = await shortRead(true);
    const calls = v1.calls.length;
    clock.now = new Date(T0.getTime() + minutes(9));

    expect(await autoRetryDailyRead(d, db, day, ours([kept, bad]))).toBeNull();
    expect(v1.calls).toHaveLength(calls);
  });
});
