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
const LAST_TICK = new Date("2026-11-04T10:00:00Z");
const after = (minutes: number) => new Date(LAST_TICK.getTime() + minutes * 60_000);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await startTick(db, LAST_TICK);
});

describe("POST /api/tick/watch", () => {
  it("posts one admin alert after 61 silent minutes, and nothing again at 70", async () => {
    const { ctx, clock, posts } = testContext(db);
    holder.ctx = ctx;
    const statuses: number[] = [];

    clock.now = after(61);
    statuses.push((await watch()).status);
    clock.now = after(70);
    statuses.push((await watch()).status);

    expect(statuses).toEqual([204, 204]);
    expect(posts.map((p) => p.url)).toEqual([ADMIN_WEBHOOK]);
    expect(posts[0]?.content).toContain("No tick for 61 min");
  });

  it("posts nothing when the last tick was 30 minutes ago", async () => {
    const { ctx, clock, posts } = testContext(db);
    holder.ctx = ctx;
    clock.now = after(30);

    expect((await watch()).status).toBe(204);
    expect(posts).toEqual([]);
  });
});
