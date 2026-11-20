// "Get today's details" (D133): one /v1 read of an alliance outside the daily read, at most once per alliance
// per server day for the whole site, on the tracker's cached copy, stored as that day's roster; refused past
// the day's cap, inside the event window, for an alliance the daily read covers, and when the read would cut
// D117's reserve.
import { count } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { LOOKUPS_PER_DAY } from "../config/alliances";
import { TEST_ENV } from "./app-context.test-helpers";
import { BOARD_EXTRA, fakeInternal, fakeV1, IDS, roster } from "./collector.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { lookupAlliance } from "./lookup";
import { memberHistoryIndex } from "./queries";
import { claimTrackedSet, storeBoard } from "./repo/alliances";
import { dailyRosters } from "./schema";
import { allianceLookups } from "./schema-alliances";
import type { CallOptions, OnAttempt } from "./sources/types";

/** Thursday 14:00 server time (UTC−2): no event running. Saturday 11:00 is inside KvK's window. */
const THU = new Date("2026-11-19T16:00:00Z");
const SAT = new Date("2026-11-21T13:00:00Z");
const DAY = "2026-11-19";
const [OTHER = 0, SECOND = 0] = BOARD_EXTRA;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await storeBoard(db, DAY, await fakeInternal().fetchRanks(325));
  await claimTrackedSet(db, { day: DAY, allianceIds: IDS, source: "board" }, THU);
});

/** The fake /v1, recording each alliance read's options; `remaining` is what /quota answers. */
function source(remaining = 900) {
  const v1 = fakeV1((id) => roster(id, new Date(THU.getTime() - 25 * 60_000)), remaining);
  const options: (CallOptions | undefined)[] = [];
  const fetchAlliance = v1.fetchAlliance;
  v1.fetchAlliance = (id: number, hook?: OnAttempt, signal?: AbortSignal, o?: CallOptions) => {
    options.push(o);
    return fetchAlliance(id, hook, signal, o);
  };
  return { v1, options };
}

const deps = (v1: ReturnType<typeof source>["v1"], at = THU) => ({
  v1,
  now: () => at,
  env: { ...TEST_ENV, SAMPLE_EVERY_MIN: 15 },
});

describe("Get today's details (D133)", () => {
  it("makes one read for two presses at the same second, on the cached copy, kept as the day's roster", async () => {
    const { v1, options } = source();

    const codes = await Promise.all([
      lookupAlliance(deps(v1), db, OTHER),
      lookupAlliance(deps(v1), db, OTHER),
    ]);

    expect(codes.sort()).toEqual(["done", "taken"]);
    expect(v1.calls).toEqual([OTHER]);
    expect(options).toEqual([{ fresh: false, maxRetries: 0 }]);
    const rows = await db.select().from(dailyRosters);
    expect(rows.map((r) => [r.readDay, r.unionId, r.isFresh])).toEqual([[DAY, OTHER, true]]);
    expect((await memberHistoryIndex(db, OTHER, { before: null }))?.entries).toHaveLength(1);
    expect(await lookupAlliance(deps(v1), db, OTHER)).toBe("taken");
  });

  it("refuses with no read: an alliance the daily read covers, the event window, and past the day's cap", async () => {
    const { v1 } = source();
    const claims = Array.from({ length: LOOKUPS_PER_DAY }, (_, i) => ({
      unionId: 1 + i,
      day: DAY,
      claimedAt: THU,
      status: "done" as const,
    }));

    expect(await lookupAlliance(deps(v1), db, IDS[0] ?? 0)).toBe("daily");
    expect(await lookupAlliance(deps(v1, SAT), db, OTHER)).toBe("event_window");
    await db.insert(allianceLookups).values(claims);
    expect(await lookupAlliance(deps(v1), db, OTHER)).toBe("cap");
    expect(v1.calls).toEqual([]);
  });

  it("keeps D117's reserve: a quota too low for the read refuses it after the quota call, for the day", async () => {
    const { v1 } = source(100);

    expect(await lookupAlliance(deps(v1), db, SECOND)).toBe("quota");
    expect(await lookupAlliance(deps(source().v1), db, SECOND)).toBe("taken");

    expect(v1.calls).toEqual([]);
    const [used] = await db.select({ n: count() }).from(dailyRosters);
    expect(used?.n).toBe(0);
  });
});
