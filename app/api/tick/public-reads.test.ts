// INVARIANT cache.write-invalidates-reads (D143): the tick's daily read and its automatic retry, /admin's
// Retry, and the scheduled event the tick creates drop the public pages' shared reads in the request, so the
// first view after the night read shows it. A tick that writes none of them leaves the shared reads alone.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { request, TEST_CRON_SECRET, TEST_PIN, testContext } from "@/lib/app-context.test-helpers";
import { ago, fakeV1, IDS, minutes, roster } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
// The squads batch after the answer (`after`) needs a Next request: not run here.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: () => undefined,
}));

const { POST } = await import("./route");
const { POST: retry } = await import("../daily-read/retry/route");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

/** A tick at `iso` (UTC) with the first alliance's read failing when `fail`, and the invalidations counted. */
function ticks() {
  const { ctx, clock } = testContext(db);
  holder.ctx = ctx;
  const [bad = 0] = IDS;
  let failing = false;
  ctx.v1 = fakeV1((id) =>
    failing && id === bad ? new Error("down") : roster(id, ago(clock.now, minutes(1))),
  );
  const invalidate = vi.spyOn(ctx.publicCache, "invalidate");
  const at = async (iso: string, fail = false) => {
    [clock.now, failing] = [new Date(`${iso}:00Z`), fail];
    invalidate.mockClear();
    const res = await POST(
      request("/api/tick", { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } }),
    );
    return { status: res.status, invalidated: invalidate.mock.calls.length };
  };
  return { at, clock, invalidate };
}

// DAILY_ROSTER_AT 23:30 server = 01:30 UTC the next day (D72).
describe("the public pages' shared reads after the tick's writes (D143)", () => {
  it("drops them after the night read and after its automatic retry, and not on a tick that read nothing", async () => {
    const { at } = ticks();

    const read = await at("2026-11-10T01:37", true);
    const autoRetry = await at("2026-11-10T01:52");
    const idle = await at("2026-11-10T02:07");

    // The night read: the day's tracked set, then the rosters.
    expect(read).toEqual({ status: 200, invalidated: 2 });
    expect(autoRetry).toEqual({ status: 200, invalidated: 1 });
    expect(idle).toEqual({ status: 204, invalidated: 0 });
  });

  it("drops them after /admin's Retry", async () => {
    const { at, clock, invalidate } = ticks();
    await at("2026-11-10T01:37", true);
    clock.now = new Date("2026-11-10T01:40:00Z");
    invalidate.mockClear();

    const res = await retry(
      request("/api/daily-read/retry", { headers: { "x-edit-pin": TEST_PIN } }),
    );

    expect(res.status).toBe(200);
    expect(invalidate).toHaveBeenCalledOnce();
  });

  it("drops them when the tick creates the coming scheduled event, once", async () => {
    const { at } = ticks();

    // Saturday 2026-11-07's Before is 12:00 UTC; its row is created a day ahead.
    const created = await at("2026-11-06T12:05");
    const again = await at("2026-11-06T12:20");

    expect([created.invalidated, again.invalidated]).toEqual([1, 0]);
  });
});
