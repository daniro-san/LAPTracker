import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import {
  ADMIN_WEBHOOK,
  request,
  TEST_CRON_SECRET,
  testContext,
} from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { startTick } from "@/lib/repo/ticks";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const { POST } = await import("./route");

const watch = () =>
  POST(request("/api/tick/watch", { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } }));
const at = (iso: string) => new Date(`${iso}Z`);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await startTick(db, at("2026-11-04T09:00")); // the 09:00 UTC heartbeat
});

describe("POST /api/tick/watch (D141: uptime.yml, every 3 h at :10)", () => {
  it("posts one admin alert when the 12:00 heartbeat never came, and nothing again on a re-run", async () => {
    const { ctx, clock, posts } = testContext(db);
    holder.ctx = ctx;
    const statuses: number[] = [];

    clock.now = at("2026-11-04T12:10");
    statuses.push((await watch()).status);
    clock.now = at("2026-11-04T12:40");
    statuses.push((await watch()).status);

    expect(statuses).toEqual([204, 204]);
    expect(posts.map((p) => p.url)).toEqual([ADMIN_WEBHOOK]);
    expect(posts[0]?.content).toContain("No tick for 190 min");
  });

  it("posts nothing when a tick came in the slot, also for a run GitHub starts 50 min or 3 h late", async () => {
    const { ctx, clock, posts } = testContext(db);
    holder.ctx = ctx;
    await startTick(db, at("2026-11-04T12:00"));

    for (const iso of ["2026-11-04T12:10", "2026-11-04T13:00", "2026-11-04T15:09"]) {
      clock.now = at(iso);
      expect((await watch()).status).toBe(204);
    }
    expect(posts).toEqual([]);
  });

  it("judges the 00:00 UTC slot across the day boundary", async () => {
    const { ctx, clock, posts } = testContext(db);
    holder.ctx = ctx;
    await startTick(db, at("2026-11-04T21:00"));

    clock.now = at("2026-11-05T00:05"); // the 00:00 slot is not judged yet: 21:00 counts
    await watch();
    expect(posts).toEqual([]);
    clock.now = at("2026-11-05T00:10"); // no 00:00 tick
    await watch();
    expect(posts.map((p) => p.content)).toEqual([expect.stringContaining("No tick for 190 min")]);
  });
});
