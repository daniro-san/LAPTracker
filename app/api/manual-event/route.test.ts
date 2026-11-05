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
import { allianceHistory, getAllianceDetail } from "@/lib/queries/alliances";
import { getEventPage } from "@/lib/queries/event-page";
import { events, snapshots } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const manualRoute = await import("./route");
const settingsRoute = await import("./settings/route");
const renameRoute = await import("./rename/route");
const snapshotRoute = await import("../snapshot/route");
const tickRoute = await import("../tick/route");

const create = (pin = TEST_PIN) =>
  manualRoute.POST(
    new Request("https://laptracker.test/api/manual-event", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", "x-edit-pin": pin },
    }),
  );
const rename = (event_id: number, name: unknown) =>
  renameRoute.POST(
    new Request("https://laptracker.test/api/manual-event/rename", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", "x-edit-pin": TEST_PIN },
      body: JSON.stringify({ event_id, name }),
    }),
  );
const settings = (event_id: number, change: Record<string, unknown>) =>
  settingsRoute.POST(
    new Request("https://laptracker.test/api/manual-event/settings", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", "x-edit-pin": TEST_PIN },
      body: JSON.stringify({ event_id, ...change }),
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
  it("creates a public round with a default name, and only for the PIN", async () => {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-05T17:00:00Z");

    const refused = await create("000000");
    const ok = await create();

    expect([refused.status, ok.status]).toEqual([401, 201]);
    const [row] = await db.select().from(events);
    expect(row).toMatchObject({ name: "Manual round 2026-11-05", manual: true, isTest: false });
    expect((await listEvents(db)).map((e) => e.name)).toEqual(["Manual round 2026-11-05"]);
  });

  it("renames a round only after a snapshot exists, and only to a plain 1-80 character name", async () => {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-04T12:00:00Z");
    const { event_id: id } = (await (await create()).json()) as { event_id: number };

    const early = await rename(id, "teste do danilo");
    await run(`phase=before&event=${id}`);
    const bad = [await rename(id, ""), await rename(id, "x".repeat(81)), await rename(id, "a\nb")];
    const ok = await rename(id, "  teste do danilo  ");
    const missing = await rename(9999, "x");

    expect(early.status).toBe(409);
    expect(await early.json()).toEqual({ code: "rename_before_run" });
    expect(bad.map((r) => r.status)).toEqual([400, 400, 400]);
    expect(ok.status).toBe(200);
    expect(missing.status).toBe(404);
    expect((await listEvents(db)).map((e) => e.name)).toEqual(["teste do danilo"]);
  });

  it("runs before and after on different days, re-runs only with force, and never posts to the public channel", async () => {
    const { ctx, clock, posts } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-04T12:00:00Z"); // Wednesday: the Saturday guard would refuse
    const { event_id: id } = (await (await create()).json()) as { event_id: number };

    const before = await run(`phase=before&event=${id}`);
    clock.now = new Date(clock.now.getTime() + 22 * 60 * minutes(1)); // the next morning
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
    await create(); // before_at = after_at = now: inside every tick window

    const res = await tick();

    expect(res.status).toBe(204);
    expect(await db.select().from(snapshots)).toEqual([]);
    expect(v1.calls).toEqual([]);
  });

  it("keeps a manual event out of an alliance's history, so Saturday's deltas skip it", async () => {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-04T12:00:00Z");
    const { event_id: id } = (await (await create()).json()) as { event_id: number };
    await run(`phase=before&event=${id}`);

    const detail = await getEventDetail(db, id);
    const history = await allianceHistory(db, 67111155);

    expect(detail?.snapshots[0]?.alliances.length).toBeGreaterThan(0);
    expect(history).toEqual([]);
  });

  it("leaves both rounds intact when the tick later runs Saturday, and Saturday compares with no demo", async () => {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-04T12:00:00Z");
    const { event_id: id } = (await (await create()).json()) as { event_id: number };
    await run(`phase=before&event=${id}`);
    clock.now = new Date("2026-11-07T12:00:00Z"); // Saturday's before_at: the tick runs it

    const res = await tick();

    expect(res.status).toBe(200);
    const rows = await db.select().from(snapshots);
    expect(rows.map((r) => [r.eventId, r.phase, r.status]).sort()).toEqual([
      [id, "before", "complete"],
      [id + 1, "before", "complete"],
    ]);
    const history = await allianceHistory(db, 67111155);
    expect(history.map((h) => h.eventId)).toEqual([id + 1]);
    expect(history[0]?.previous).toBeNull();
  });

  it("shows a round by its visibility: admin only is hidden everywhere public, history joins Saturday's chain", async () => {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-04T12:00:00Z");
    const { event_id: id } = (await (await create()).json()) as { event_id: number };
    await run(`phase=before&event=${id}`);
    clock.now = new Date("2026-11-07T12:00:00Z");
    await tick(); // Saturday's BEFORE
    const saturday = id + 1;
    const view = async () => ({
      listed: (await listEvents(db)).some((e) => e.id === id),
      detail: (await getEventDetail(db, id)) !== null,
      alliance: (await getAllianceDetail(db, id, 67111155)) !== null,
      chain: (await allianceHistory(db, 67111155)).map((h) => h.eventId),
      home: (await getEventPage(db, null)).page?.detail.id,
    });

    const states = [];
    for (const visibility of ["admin", "standalone", "history"]) {
      await settings(id, { visibility });
      states.push(await view());
    }

    expect(states).toEqual([
      { listed: false, detail: false, alliance: false, chain: [saturday], home: saturday },
      { listed: true, detail: true, alliance: true, chain: [saturday], home: saturday },
      { listed: true, detail: true, alliance: true, chain: [id, saturday], home: saturday },
    ]);
    const history = await allianceHistory(db, 67111155);
    expect(history[1]?.previous).not.toBeNull();
  });

  it("posts the public message only when the round's toggle is on, and refuses admin only with it", async () => {
    const { ctx, clock, posts } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-04T12:00:00Z");
    const { event_id: id } = (await (await create()).json()) as { event_id: number };
    const publicPosts = () => posts.filter((p) => p.url === PUBLIC_WEBHOOK).length;

    await run(`phase=before&event=${id}`);
    const off = publicPosts();
    await settings(id, { post_public: true });
    await run(`phase=after&event=${id}`);
    const on = publicPosts();
    const refused = await settings(id, { visibility: "admin" });
    const switched = await settings(id, { visibility: "admin", post_public: false });
    const stillRefused = await settings(id, { post_public: true });

    expect([off, on]).toEqual([0, 1]);
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ code: "admin_cannot_post" });
    expect(switched.status).toBe(200);
    expect(stillRefused.status).toBe(409);
  });
});
