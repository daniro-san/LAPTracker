import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { request, TEST_CRON_SECRET, TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { IDS } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { snapshots } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST } = await import("./route");

const tick = () =>
  POST(request("/api/tick", { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } }));

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
}, 30_000);
beforeEach(async () => {
  await truncateAll(db);
});

describe("POST /api/tick", () => {
  it("runs BEFORE exactly once across three ticks inside its window and never outside it", async () => {
    // Server is UTC−2: BEFORE 10:00 server = 12:00 UTC, window 45 min → [12:00, 12:45) UTC.
    const { ctx, clock, v1 } = testContext(db);
    holder.ctx = ctx;
    const statuses: [string, number][] = [];
    for (const at of ["11:59", "12:05", "12:20", "12:40", "12:45", "13:30"]) {
      clock.now = new Date(`2026-11-07T${at}:00Z`);
      statuses.push([at, (await tick()).status]);
    }

    expect(statuses).toEqual([
      ["11:59", 204],
      ["12:05", 200],
      ["12:20", 204],
      ["12:40", 204],
      ["12:45", 204],
      ["13:30", 204],
    ]);
    const rows = await db
      .select({ phase: snapshots.phase, status: snapshots.status })
      .from(snapshots);
    expect(rows).toEqual([{ phase: "before", status: "complete" }]);
    expect(v1.calls).toHaveLength(IDS.length);
  });

  it("runs only the earlier phase when both phases are due in the same tick", async () => {
    // AFTER at 10:30 server: at 10:35 server (12:35 UTC) both windows are open.
    const { ctx, clock } = testContext(db, { ...TEST_ENV, SNAPSHOT_AFTER: "10:30" });
    holder.ctx = ctx;
    clock.now = new Date("2026-11-07T12:35:00Z");

    const res = await tick();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ phase: "before", status: "complete" });
    const rows = await db.select({ phase: snapshots.phase }).from(snapshots);
    expect(rows).toEqual([{ phase: "before" }]);
  });
});
