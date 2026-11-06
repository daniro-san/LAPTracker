import { eq, inArray } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import {
  ADMIN_WEBHOOK,
  PUBLIC_WEBHOOK,
  request,
  TEST_CRON_SECRET,
  TEST_ENV,
  TEST_PIN,
  testContext,
} from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createRepo } from "@/lib/repo";
import { insertRunLog } from "@/lib/repo/run-logs";
import { allianceSnapshots, events, memberSnapshots, runLogs, snapshots } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const rehearsal = await import("./route");
const tickRoute = await import("../tick/route");

const rehearse = () =>
  rehearsal.POST(request("/api/rehearsal", { headers: { "x-edit-pin": TEST_PIN } }));
const tick = () =>
  tickRoute.POST(
    request("/api/tick", { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } }),
  );
const minutesAfter = (t: Date, n: number) => new Date(t.getTime() + n * 60_000);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

describe("POST /api/rehearsal", () => {
  it("refuses a rehearsal 2 h 59 min before a real BEFORE and allows one 3 h 01 min before", async () => {
    // BEFORE at Sat 01:00 server = Sat 03:00 UTC; test both sides of the 3 h boundary.
    const { ctx, clock } = testContext(db, { ...TEST_ENV, SNAPSHOT_BEFORE: "01:00" });
    holder.ctx = ctx;

    clock.now = new Date("2026-11-07T00:01:00Z"); // 2 h 59 min before
    const inside = await rehearse();
    clock.now = new Date("2026-11-06T23:59:00Z"); // 3 h 01 min before
    const outside = await rehearse();

    expect(inside.status).toBe(409);
    expect(await inside.json()).toEqual({ code: "rehearsal_before_real" });
    expect(outside.status).toBe(201);
  });

  it("keeps REHEARSAL_KEEP rehearsals and deletes the oldest with all its rows", async () => {
    const { ctx, clock } = testContext(db, { ...TEST_ENV, REHEARSAL_KEEP: 2 });
    holder.ctx = ctx;
    const created: number[] = [];
    // Mon, Tue, Wed 10:00 server: never pending, never on the event days.
    for (const day of ["2026-11-02", "2026-11-03", "2026-11-04"]) {
      clock.now = new Date(`${day}T12:00:00Z`);
      const res = await rehearse();
      expect(res.status).toBe(201);
      created.push(((await res.json()) as { event_id: number }).event_id);
      if (created.length === 1) {
        // Give the oldest rehearsal a snapshot with a row, a member and a log line.
        const repo = createRepo(db);
        const id = (await repo.startSnapshot(created[0] ?? 0, "before", clock.now, null)) ?? 0;
        await repo.insertAllianceRow(
          id,
          {
            unionId: 1,
            tag: "T",
            name: "n",
            memberCount: 1,
            totalPower: 1,
            totalKills: 1,
            serverRank: null,
            level: null,
            badgeId: null,
            powerBoard: null,
            killsBoard: null,
            source: "v1",
            sourceUpdatedAt: clock.now,
            cached: false,
            isFresh: true,
            error: null,
            raw: {},
          },
          [{ uid: 9, name: "m", power: 1, kills: 1, lv: 1 }],
        );
        await insertRunLog(db, {
          snapshotId: id,
          at: clock.now,
          level: "info",
          code: "x",
          unionId: null,
          data: {},
        });
      }
    }

    const left = await db.select({ id: events.id }).from(events);
    expect(left.map((e) => e.id).sort()).toEqual(created.slice(1).sort());
    expect(await db.select().from(snapshots)).toEqual([]);
    expect(await db.select().from(allianceSnapshots)).toEqual([]);
    expect(await db.select().from(memberSnapshots)).toEqual([]);
    expect(await db.select().from(runLogs)).toEqual([]);
  });

  it("runs a rehearsal created at T: BEFORE on the first tick at or after T+15, AFTER at T+45", async () => {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    const T = new Date("2026-11-04T12:00:00Z"); // Wed 10:00 server
    clock.now = T;
    expect((await rehearse()).status).toBe(201);

    const results: [number, number, string | null][] = [];
    for (const m of [14, 15, 30, 44, 45, 50]) {
      clock.now = minutesAfter(T, m);
      const res = await tick();
      results.push([
        m,
        res.status,
        res.status === 200 ? ((await res.json()) as { phase: string }).phase : null,
      ]);
    }

    expect(results).toEqual([
      [14, 204, null],
      [15, 200, "before"],
      [30, 204, null],
      [44, 204, null],
      [45, 200, "after"],
      [50, 204, null],
    ]);
  });

  it("posts a rehearsal's run messages and verdict to the admin channel only, marked [rehearsal]", async () => {
    const { ctx, clock, posts, edits } = testContext(db);
    holder.ctx = ctx;
    const T = new Date("2026-11-04T12:00:00Z");
    clock.now = T;
    const { event_id: eventId } = (await (await rehearse()).json()) as { event_id: number };
    for (const m of [15, 45]) {
      clock.now = minutesAfter(T, m);
      expect((await tick()).status).toBe(200);
    }

    const ran = await db
      .select({ phase: snapshots.phase })
      .from(snapshots)
      .where(inArray(snapshots.eventId, [eventId]));
    expect(ran).toHaveLength(2);
    expect(posts.filter((p) => p.url === PUBLIC_WEBHOOK)).toEqual([]);
    // One message: posted by the BEFORE, edited by the AFTER with the verdict at its end (D31).
    expect(posts.filter((p) => p.url === ADMIN_WEBHOOK)).toHaveLength(1);
    const edit = edits.filter((e) => e.url === ADMIN_WEBHOOK);
    expect(edit).toHaveLength(1);
    const text = edit[0]?.content ?? "";
    expect(text.startsWith("[rehearsal] ")).toBe(true);
    expect(text).toMatch(/Before snapshot[\s\S]*After snapshot[\s\S]*(✓ Pass|✗ Fail)/);
    const [event] = await db.select().from(events).where(eq(events.id, eventId));
    expect(event?.isTest).toBe(true);
    expect(event?.discordAdminMessageId).toBe(edit[0]?.messageId);
    expect(event?.discordPublicMessageId).toBeNull();
  });
});
