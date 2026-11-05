import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import {
  PUBLIC_WEBHOOK,
  TEST_CRON_SECRET,
  TEST_PIN,
  testContext,
} from "@/lib/app-context.test-helpers";
import { minutes } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { getEventDetail, listEvents } from "@/lib/queries";
import { allianceHistory } from "@/lib/queries/alliances";
import { events, snapshots } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const manualRoute = await import("./route");
const snapshotRoute = await import("../snapshot/route");
const tickRoute = await import("../tick/route");

const create = (name: unknown, pin = TEST_PIN) =>
  manualRoute.POST(
    new Request("https://laptracker.test/api/manual-event", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", "x-edit-pin": pin },
      body: JSON.stringify({ name }),
    }),
  );
const run = (query: string) =>
  snapshotRoute.POST(
    new Request(`https://laptracker.test/api/snapshot?${query}`, {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", "x-edit-pin": TEST_PIN },
    }),
  );
const tick = () =>
  tickRoute.POST(
    new Request("https://laptracker.test/api/tick", {
      method: "POST",
      headers: { authorization: `Bearer ${TEST_CRON_SECRET}` },
    }),
  );

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
}, 30_000);
beforeEach(async () => {
  await truncateAll(db);
});

describe("manual events (D28)", () => {
  it("creates a public event from a typed name, and only for the PIN", async () => {
    const { ctx } = testContext(db);
    holder.ctx = ctx;

    const refused = await create("Demo", "000000");
    const empty = await create("   ");
    const ok = await create("  Alliance leaders demo  ");

    expect([refused.status, empty.status, ok.status]).toEqual([401, 400, 201]);
    const [row] = await db.select().from(events);
    expect(row).toMatchObject({ name: "Alliance leaders demo", manual: true, isTest: false });
    expect((await listEvents(db)).map((e) => e.name)).toEqual(["Alliance leaders demo"]);
  });

  it("runs before and after on a weekday, re-runs only with force, and never posts to the public channel", async () => {
    const { ctx, clock, posts } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-04T12:00:00Z"); // Wednesday: the Saturday guard would refuse
    const { event_id: id } = (await (await create("Demo")).json()) as { event_id: number };

    const before = await run(`phase=before&event=${id}`);
    clock.now = new Date(clock.now.getTime() + minutes(5));
    const after = await run(`phase=after&event=${id}`);
    const again = await run(`phase=after&event=${id}`);
    const forced = await run(`phase=after&event=${id}&force=1`);

    expect([before.status, after.status, again.status, forced.status]).toEqual([
      200, 200, 409, 200,
    ]);
    expect(await again.json()).toMatchObject({ code: "snapshot_complete" });
    const rows = await db.select().from(snapshots).where(eq(snapshots.eventId, id));
    expect(rows.map((s) => [s.phase, s.status]).sort()).toEqual([
      ["after", "complete"],
      ["before", "complete"],
    ]);
    expect(posts.some((p) => p.url === PUBLIC_WEBHOOK)).toBe(false);
  });

  it("refuses an event id that is not manual, so the Saturday guard stays", async () => {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-04T12:00:00Z");
    const [saturday] = await db
      .insert(events)
      .values({
        name: "Saturday",
        eventAtUtc: new Date("2026-11-07T14:00:00Z"),
        beforeAt: new Date("2026-11-07T12:00:00Z"),
        afterAt: new Date("2026-11-07T16:00:00Z"),
        allianceIds: [],
      })
      .returning({ id: events.id });

    const res = await run(`phase=before&event=${saturday?.id}&force=1`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "event_not_found" });
    expect(await db.select().from(snapshots)).toEqual([]);
  });

  it("is never run by the tick, even inside its fresh window", async () => {
    const { ctx, clock, v1 } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-04T12:00:00Z");
    await create("Demo"); // before_at = after_at = now: inside every tick window

    const res = await tick();

    expect(res.status).toBe(204);
    expect(await db.select().from(snapshots)).toEqual([]);
    expect(v1.calls).toEqual([]);
  });

  it("keeps a manual event out of an alliance's history, so Saturday's deltas skip it", async () => {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-04T12:00:00Z");
    const { event_id: id } = (await (await create("Demo")).json()) as { event_id: number };
    await run(`phase=before&event=${id}`);

    const detail = await getEventDetail(db, id);
    const history = await allianceHistory(db, 67111155);

    expect(detail?.snapshots[0]?.alliances.length).toBeGreaterThan(0);
    expect(history).toEqual([]);
  });
});
