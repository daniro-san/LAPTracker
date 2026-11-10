import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import {
  ADMIN_WEBHOOK,
  request,
  TEST_CRON_SECRET,
  TEST_ENV,
  testContext,
} from "@/lib/app-context.test-helpers";
import { IDS } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { dailyReads, dailyRosters, events, rehearsalSlots, snapshots, tickLog } from "@/lib/schema";

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
});
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

  it("writes a heartbeat row with its start, end and outcome", async () => {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-04T10:00:00Z");

    expect((await tick()).status).toBe(204);

    expect(await db.select().from(tickLog)).toEqual([
      { id: 1, startedAt: clock.now, finishedAt: clock.now, outcome: "idle" },
    ]);
  });

  it("writes no heartbeat row for a tick with the wrong secret", async () => {
    holder.ctx = testContext(db).ctx;

    const res = await POST(request("/api/tick", { headers: { authorization: "Bearer wrong" } }));

    expect(res.status).toBe(401);
    expect(await db.select().from(tickLog)).toEqual([]);
  });

  it("answers 204, not 409, to a tick that loses its phase to a concurrent caller", async () => {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-07T12:05:00Z");

    const statuses = (await Promise.all([tick(), tick()])).map((r) => r.status).sort();

    expect(statuses).toEqual([200, 204]);
    expect(await db.select({ id: snapshots.id }).from(snapshots)).toHaveLength(1);
  });

  it("answers by 115 s from the run's start even when Discord never answers", async () => {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-07T12:05:00Z");
    // The run has used 116 s by the time it reads the quota; then every webhook call hangs.
    const fetchQuota = ctx.v1.fetchQuota;
    ctx.v1.fetchQuota = async (...args) => {
      clock.now = new Date(clock.now.getTime() + 116_000);
      return fetchQuota(...args);
    };
    ctx.fetch = () => new Promise<Response>(() => {});

    const res = await tick();

    expect(res.status).toBe(200);
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

  it("creates the coming scheduled event once, a day ahead, with its phase times from the env", async () => {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    // Saturday 2026-11-07 BEFORE is 10:00 server = 12:00 UTC; a day ahead is Friday 12:00 UTC.
    for (const at of [
      "2026-11-06T11:45",
      "2026-11-06T12:05",
      "2026-11-06T12:20",
      "2026-11-07T09:00",
    ]) {
      clock.now = new Date(`${at}:00Z`);
      await tick();
      if (at === "2026-11-06T11:45") expect(await db.select().from(events)).toEqual([]);
    }

    const rows = await db
      .select({
        name: events.name,
        isTest: events.isTest,
        eventAtUtc: events.eventAtUtc,
        beforeAt: events.beforeAt,
        afterAt: events.afterAt,
      })
      .from(events);
    expect(rows).toEqual([
      {
        name: "Saturday Event 2026-11-07",
        isTest: false,
        eventAtUtc: new Date("2026-11-07T14:00:00Z"),
        beforeAt: new Date("2026-11-07T12:00:00Z"),
        afterAt: new Date("2026-11-07T16:00:00Z"),
      },
    ]);
  });

  it("creates a REHEARSAL_AT rehearsal once per slot per week, never on the event day or the day after", async () => {
    const env = { ...TEST_ENV, REHEARSAL_AT: "wed 18:00, sat 18:00, sun 09:00" };
    const { ctx, clock, posts } = testContext(db, env);
    holder.ctx = ctx;
    // Server time is UTC−2. Wed 18:05 twice, Sat 18:05, Sun 09:05, then next Wed 18:05.
    const ticks = [
      "2026-11-04T20:05",
      "2026-11-04T20:10",
      "2026-11-07T20:05",
      "2026-11-08T11:05",
      "2026-11-11T20:05",
    ];
    for (const at of ticks) {
      clock.now = new Date(`${at}:00Z`);
      await tick();
    }

    const rehearsals = await db
      .select({ beforeAt: events.beforeAt })
      .from(events)
      .where(eq(events.isTest, true));
    expect(rehearsals.map((r) => r.beforeAt)).toEqual([
      new Date("2026-11-04T20:20:00Z"),
      new Date("2026-11-11T20:20:00Z"),
    ]);
    const slots = await db
      .select({ slotAt: rehearsalSlots.slotAt, outcome: rehearsalSlots.outcome })
      .from(rehearsalSlots);
    expect(slots).toEqual([
      { slotAt: new Date("2026-11-04T20:00:00Z"), outcome: "created" },
      { slotAt: new Date("2026-11-07T20:00:00Z"), outcome: "event-day" },
      { slotAt: new Date("2026-11-08T11:00:00Z"), outcome: "event-day" },
      { slotAt: new Date("2026-11-11T20:00:00Z"), outcome: "created" },
    ]);
    const notes = posts.filter((p) => p.url === ADMIN_WEBHOOK && p.content.includes("skipped"));
    expect(notes).toHaveLength(2);
    expect(notes.every((n) => n.content.startsWith("[rehearsal] "))).toBe(true);
  });

  it("runs the daily roster read once per server day, only after a due phase and never as an event", async () => {
    // DAILY_ROSTER_AT on BEFORE's time (10:00 server = 12:00 UTC): both are due at 12:05 UTC.
    const { ctx, clock, v1 } = testContext(db, { ...TEST_ENV, DAILY_ROSTER_AT: "10:00" });
    holder.ctx = ctx;
    const answers: unknown[] = [];
    for (const at of ["12:05", "12:20", "12:35"]) {
      clock.now = new Date(`2026-11-07T${at}:00Z`);
      const res = await tick();
      answers.push(
        res.status === 204
          ? 204
          : (({ action, phase }) => action ?? phase)(
              (await res.json()) as { action?: string; phase?: string },
            ),
      );
    }

    expect(answers).toEqual(["before", "daily-read", 204]);
    expect(
      await db.select({ day: dailyReads.day, status: dailyReads.status }).from(dailyReads),
    ).toEqual([{ day: "2026-11-07", status: "complete" }]);
    expect(await db.select({ id: dailyRosters.id }).from(dailyRosters)).toHaveLength(IDS.length);
    expect(await db.select({ id: events.id }).from(events)).toHaveLength(1);
    expect(v1.calls).toHaveLength(2 * IDS.length);
  });
});
