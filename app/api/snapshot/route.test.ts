import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import {
  ADMIN_WEBHOOK,
  request,
  TEST_CRON_SECRET,
  TEST_PIN,
  testContext,
} from "@/lib/app-context.test-helpers";
import type { Deps } from "@/lib/collector";
import { minutes, T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createRepo } from "@/lib/repo";
import { findOrCreateEvent } from "@/lib/repo/events";
import { currentEvent } from "@/lib/schedule";
import { authAttempts, runLogs, snapshots } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null, crash: false }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
// A collector that claims its snapshot, logs, then throws past its own handling.
vi.mock("@/lib/collector", async (original) => {
  const real = await original<typeof import("@/lib/collector")>();
  return {
    ...real,
    runSnapshot: (eventId: number, phase: "before" | "after", deps: Deps, options = {}) => {
      if (!holder.crash) return real.runSnapshot(eventId, phase, deps, options);
      return (async () => {
        await deps.repo.startSnapshot(eventId, phase, deps.now(), null);
        await deps.logger.info("snapshot.start", {});
        // Fired and forgotten, as the collector's v1.retry line is.
        void deps.logger.warn("v1.retry", { retry_n: 1 });
        throw new TypeError("boom from a third party");
      })();
    },
  };
});

// The forgotten v1.retry insert lands many macrotasks after every other query, as an insert on
// another pooled Neon connection can: only an awaited logger.shutdown() gets it in before the response.
vi.mock("@/lib/repo/run-logs", async (original) => {
  const real = await original<typeof import("@/lib/repo/run-logs")>();
  return {
    insertRunLog: async (...args: Parameters<typeof real.insertRunLog>) => {
      const yields = args[1].code === "v1.retry" ? 500 : 0;
      for (let i = 0; i < yields; i++) await new Promise((resolve) => setImmediate(resolve));
      return real.insertRunLog(...args);
    },
  };
});

const importRoute = () => import("./route");

const post = (
  route: Awaited<ReturnType<typeof importRoute>>,
  headers: Record<string, string>,
  query = "phase=before",
) => route.POST(request(`/api/snapshot?${query}`, { headers }));

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
}, 30_000);
beforeEach(async () => {
  await truncateAll(db);
  holder.crash = false;
});

async function currentEventId() {
  const event = currentEvent(T0, holder.ctx?.env ?? testContext(db).ctx.env);
  return (await findOrCreateEvent(db, event)).id;
}

describe("POST /api/snapshot", () => {
  it("answers 409 without upstream calls while another run holds the lock", async () => {
    const { ctx, v1 } = testContext(db);
    holder.ctx = ctx;
    const eventId = await currentEventId();
    await createRepo(db).startSnapshot(
      eventId,
      "before",
      new Date(T0.getTime() - minutes(2)),
      null,
    );

    const res = await post(await importRoute(), { authorization: `Bearer ${TEST_CRON_SECRET}` });

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ code: "snapshot_running", snapshot_id: null });
    expect(v1.calls).toEqual([]);
  });

  it("refuses a manual run before the event's before_at, force included", async () => {
    const { ctx, clock, v1 } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-04T12:00:00Z"); // Wednesday: the current event is 2026-11-07

    const res = await post(
      await importRoute(),
      { authorization: `Bearer ${TEST_CRON_SECRET}` },
      "phase=before&force=1",
    );

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ code: "snapshot_not_due", snapshot_id: null });
    expect(await db.select().from(snapshots)).toEqual([]);
    expect(v1.calls).toEqual([]);
  });

  it("finalises the snapshot as failed and settles its logs when the collector throws", async () => {
    holder.ctx = testContext(db).ctx;
    holder.crash = true;

    const res = await post(await importRoute(), { authorization: `Bearer ${TEST_CRON_SECRET}` });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ code: "run_failed", snapshot_id: 1 });
    expect(JSON.stringify(body)).not.toContain("boom");
    const [row] = await db.select().from(snapshots);
    expect(row).toMatchObject({ status: "failed", callsUsed: 0, finishedAt: T0 });
    expect(row?.error).not.toContain("boom");
    const codes = (await db.select({ code: runLogs.code }).from(runLogs)).map((l) => l.code);
    expect(codes.sort()).toEqual(["run.crashed", "snapshot.start", "v1.retry"]);
  });

  it("accepts only CRON_SECRET as a bearer and only EDIT_PIN as x-edit-pin", async () => {
    holder.ctx = testContext(db).ctx;
    const route = await importRoute();
    const attempts: [string, Record<string, string>][] = [
      ["none", {}],
      ["wrong bearer", { authorization: "Bearer wrong-secret" }],
      ["PIN as bearer", { authorization: `Bearer ${TEST_PIN}` }],
      ["secret as PIN", { "x-edit-pin": TEST_CRON_SECRET }],
      ["wrong PIN", { "x-edit-pin": "000000" }],
      ["PIN plus a digit", { "x-edit-pin": `${TEST_PIN}0` }],
      ["CRON_SECRET", { authorization: `Bearer ${TEST_CRON_SECRET}` }],
      ["EDIT_PIN", { "x-edit-pin": TEST_PIN }],
    ];
    const statuses: [string, number][] = [];
    for (const [i, [label, headers]] of attempts.entries()) {
      // One IP each, so the per-IP limit stays out of this test.
      const res = await post(route, { ...headers, "x-real-ip": `203.0.113.${i}` }, "phase=after");
      statuses.push([label, res.status]);
    }

    expect(statuses).toEqual([
      ["none", 401],
      ["wrong bearer", 401],
      ["PIN as bearer", 401],
      ["secret as PIN", 401],
      ["wrong PIN", 401],
      ["PIN plus a digit", 401],
      ["CRON_SECRET", 200],
      ["EDIT_PIN", 200], // the first AFTER failed (no alliances on the event), so it runs again
    ]);
  });

  it("blocks the 6th attempt from one IP, counted in the database across a fresh module import", async () => {
    holder.ctx = testContext(db).ctx;
    const ip = { "x-real-ip": "192.0.2.7" };
    const first = await importRoute();
    const early: number[] = [];
    for (let i = 0; i < 5; i++)
      early.push((await post(first, { ...ip, "x-edit-pin": "111111" })).status);
    vi.resetModules();
    const fresh = await importRoute();

    const sixth = await post(fresh, { ...ip, "x-edit-pin": TEST_PIN });

    expect(fresh).not.toBe(first);
    expect(early).toEqual([401, 401, 401, 401, 401]);
    expect(sixth.status).toBe(429);
    expect(await sixth.json()).toEqual({ code: "rate_limited" });
    const [row] = await db
      .select({ count: authAttempts.count })
      .from(authAttempts)
      .where(eq(authAttempts.key, "ip:192.0.2.7"));
    expect(row?.count).toBe(5);
  });

  it("locks PIN auth after 20 wrong PINs across IPs, alerts once, and never locks out CRON_SECRET", async () => {
    const { ctx, posts } = testContext(db);
    holder.ctx = ctx;
    const first = await importRoute();
    for (let i = 0; i < 19; i++) {
      await post(first, { "x-real-ip": `198.18.0.${i}`, "x-edit-pin": "222222" });
    }
    vi.resetModules();
    const fresh = await importRoute();

    const twentieth = await post(fresh, { "x-real-ip": "198.18.1.1", "x-edit-pin": "222222" });
    const correctPin = await post(fresh, { "x-real-ip": "198.18.1.2", "x-edit-pin": TEST_PIN });
    const cron = await post(fresh, {
      "x-real-ip": "198.18.1.3",
      authorization: `Bearer ${TEST_CRON_SECRET}`,
    });

    expect(twentieth.status).toBe(401);
    expect(correctPin.status).toBe(429);
    expect(await correctPin.json()).toEqual({ code: "pin_locked" });
    expect(cron.status).toBe(200);
    const alerts = posts.filter(
      (p) => p.url === ADMIN_WEBHOOK && p.content.includes("PIN entry is locked"),
    );
    expect(alerts).toHaveLength(1);
  });
});
