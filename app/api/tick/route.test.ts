import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { OWN_ALLIANCE_ID } from "@/config/alliances";
import type { AppContext } from "@/lib/app-context";
import {
  ADMIN_WEBHOOK,
  request,
  TEST_CRON_SECRET,
  TEST_ENV,
  TEST_PIN,
  testContext,
} from "@/lib/app-context.test-helpers";
import { ago, fakeV1, IDS, minutes, roster } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { noQueryDb, openTestDb, truncateAll } from "@/lib/db.test-helpers";
import {
  dailyReads,
  dailyRosters,
  events,
  rehearsalSlots,
  snapshots,
  tickLog,
  workspaces,
} from "@/lib/schema";
import { squadReads } from "@/lib/schema-squads";
import { playerAnswer } from "@/lib/squads.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
// Work after the answer (`after`) needs a Next request; here it is kept to be run by the test.
const later = vi.hoisted(() => [] as (() => Promise<void>)[]);
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => void later.push(task),
}));

const { POST } = await import("./route");
const { POST: retry } = await import("../daily-read/retry/route");

const tick = () =>
  POST(request("/api/tick", { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } }));

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  later.length = 0;
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
    clock.now = new Date("2026-11-04T12:00:00Z"); // the 3-hourly heartbeat slot (D141)

    expect((await tick()).status).toBe(204);

    expect(await db.select().from(tickLog)).toEqual([
      { id: 1, startedAt: clock.now, finishedAt: clock.now, outcome: "idle" },
    ]);
  });

  it("asks the database nothing and starts no batch on a tick with nothing that can be due (D141)", async () => {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    clock.now = new Date("2026-11-04T16:00:00Z"); // Wednesday 14:00 ST
    // The first idle tick keeps what only the database knows: no rehearsal pending, the queue settled.
    expect((await tick()).status).toBe(204);
    later.length = 0;
    ctx.openDb = () => ({ db: noQueryDb, close: async () => {} });
    clock.now = new Date("2026-11-04T16:15:00Z");

    expect((await tick()).status).toBe(204);
    expect(later).toEqual([]);
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
    // The run has used 116 s by the time it reads the quota (past its deadline: it closes partial); then
    // every webhook call hangs.
    const fetchQuota = ctx.v1.fetchQuota;
    ctx.v1.fetchQuota = async (...args) => {
      clock.now = new Date(clock.now.getTime() + 116_000);
      return fetchQuota(...args);
    };
    ctx.fetch = () => new Promise<Response>(() => {});

    const res = await tick();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ phase: "before", status: "partial" });
    const rows = await db.select({ status: snapshots.status }).from(snapshots);
    expect(rows).toEqual([{ status: "partial" }]);
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

  // DAILY_ROSTER_AT 23:30 server = 01:30 UTC the next day, window 45 min (D72). Saturday 2026-11-07 is the
  // event's day.
  /** A tick at `iso` (UTC), with the first alliance's read failing when `fail`: its answer (the phase,
   * "<day> <status>" for a daily read, or 204) and the alliances it read. */
  function dailyTicks() {
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    const [bad = 0] = IDS;
    let failing = false;
    const v1 = fakeV1((id) =>
      failing && id === bad ? new Error("down") : roster(id, ago(clock.now, minutes(1))),
    );
    ctx.v1 = v1;
    const at = async (iso: string, fail = false) => {
      [clock.now, failing] = [new Date(`${iso}:00Z`), fail];
      const from = v1.calls.length;
      const res = await tick();
      const body = res.status === 204 ? null : ((await res.json()) as Record<string, unknown>);
      const answer = body ? (body.phase ?? `${String(body.day)} ${String(body.status)}`) : 204;
      return { answer, calls: v1.calls.slice(from) };
    };
    return { at, bad, clock };
  }
  const days = () => db.select({ day: dailyReads.day, status: dailyReads.status }).from(dailyReads);
  const rosterRows = async () =>
    (await db.select({ id: dailyRosters.id }).from(dailyRosters)).length;

  it("reads every roster at 23:37 on the event's day, after its Before, and closes partial when one fails", async () => {
    const { at } = dailyTicks();

    const before = await at("2026-11-07T12:05");
    const read = await at("2026-11-08T01:37", true);

    expect([before.answer, read.answer]).toEqual(["before", "2026-11-07 partial"]);
    expect([before.calls, read.calls].map((c) => c.length)).toEqual([IDS.length, IDS.length]);
  });

  it("re-reads at 23:52 only the alliance the 23:37 read left without a roster, and completes the day", async () => {
    const { at, bad } = dailyTicks();
    await at("2026-11-07T12:05");
    await at("2026-11-08T01:37", true);

    const retry = await at("2026-11-08T01:52");

    expect(retry).toEqual({ answer: "2026-11-07 complete", calls: [bad] });
    expect(await days()).toEqual([{ day: "2026-11-07", status: "complete" }]);
    expect(await rosterRows()).toBe(IDS.length);
  });

  it("refuses a Retry at 23:58:30, which could run past the server day's end", async () => {
    const { at, clock } = dailyTicks();
    await at("2026-11-08T01:37", true);
    clock.now = new Date("2026-11-08T01:58:30Z");

    const late = await retry(
      request("/api/daily-read/retry", { headers: { "x-edit-pin": TEST_PIN } }),
    );

    expect([late.status, await late.json()]).toEqual([409, { code: "daily_read_too_late" }]);
    expect(await days()).toEqual([{ day: "2026-11-07", status: "partial" }]);
  });

  it("reads nothing at 23:52 when the 23:37 read was complete", async () => {
    const { at } = dailyTicks();

    const read = await at("2026-11-09T01:37");
    const later = await at("2026-11-09T01:52");

    expect([read.answer, later.answer]).toEqual(["2026-11-08 complete", 204]);
    expect([read.calls.length, later.calls]).toEqual([IDS.length, []]);
    expect(await days()).toEqual([{ day: "2026-11-08", status: "complete" }]);
    expect(await rosterRows()).toBe(IDS.length);
  });

  it("reads nothing after the server midnight when the day's ticks inside its window were missed", async () => {
    const { at } = dailyTicks();

    // Tue 00:07 server is inside Monday's 23:30 + 45 min window, but on Tuesday.
    expect(await at("2026-11-10T02:07")).toEqual({ answer: 204, calls: [] });
    expect(await days()).toEqual([]);
  });

  it("starts a squads batch after the day's read, and none on a day whose read never came (D141)", async () => {
    // D117, amendment 2026-11-19; D132: cron-job.org's ticks at :00/:15/:30/:45 carry the squads queue.
    // D125: the own alliance is read only while it has a workspace.
    await db
      .insert(workspaces)
      .values({ unionId: OWN_ALLIANCE_ID, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
    const { ctx, clock } = testContext(db);
    holder.ctx = ctx;
    const players: number[] = [];
    ctx.v1.fetchPlayer = async (uid, onAttempt) => {
      onAttempt?.(0);
      players.push(uid);
      return playerAnswer(uid);
    };
    clock.now = new Date("2026-11-10T13:00:00Z"); // Tuesday 11:00 server time: Monday's read never came
    expect((await tick()).status).toBe(204);
    expect(later).toHaveLength(0);

    clock.now = new Date("2026-11-11T01:30:00Z"); // Tuesday 23:30 server time: the daily read answers
    expect((await tick()).status).toBe(200);
    // The squads batch first, then the catalog posts due from the daily read (D159, the welcome).
    expect(later).toHaveLength(2);
    expect(players).toEqual([]); // nothing before the answer
    await later[0]?.();
    const own = (OWN_ALLIANCE_ID * 10 + 1) as number;
    expect(players).toEqual([own, own + 1, own + 2]);
    const [read] = await db.select().from(squadReads);
    expect(read).toMatchObject({ day: "2026-11-10", status: "done", callsUsed: 3 });
  });
});
