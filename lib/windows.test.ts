// Event windows (D160) through the tick on PGlite: an Origin of Chaos-shaped event on Saturday 2026-12-05,
// window 1 00:00…00:45 and window 2 12:15…13:15 server (02:00…02:45 and 14:15…15:15 UTC), a tick every
// 15 minutes. Kills grow inside the windows and much more between them, so the event's change (the sum of
// its windows' changes) differs from End − Start.
import { asc, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PUBLIC_WEBHOOK, ADMIN_WEBHOOK, TEST_ENV, testContext } from "./app-context.test-helpers";
import { fakeV1, IDS, minutes, roster } from "./collector.test-helpers";
import { sumKills } from "./compute";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import type { EventImageInput } from "./event-image";
import { topGains } from "./notify";
import { allianceHistory } from "./queries";
import { getEventPage } from "./queries/event-page";
import { eventProgress } from "./queries/live";
import { findOrCreateEvent } from "./repo/events";
import { snapshots } from "./schema";
import { runTick, type TickOutcome } from "./tick";

// The picture (D58) is drawn by a real renderer that can take seconds under load: its input is kept instead.
const drawn = vi.hoisted(() => [] as EventImageInput[]);
vi.mock("./event-image", () => ({
  eventImage: async (input: EventImageInput) => {
    drawn.push(input);
    return new Uint8Array([1]);
  },
}));
vi.setConfig({ testTimeout: 60_000 });

// The env's weekly event on a Wednesday and the daily read in the evening, so neither runs in these ticks.
const ENV = { ...TEST_ENV, EVENT_WEEKDAY: 3, DAILY_ROSTER_AT: "20:00", SAMPLE_EVERY_MIN: 15 };
const ORIGIN = "https://laptracker.test";
const utc = (hhmm: string) => new Date(`2026-12-05T${hhmm}:00Z`);
const W1 = { beforeAt: utc("02:00"), afterAt: utc("02:45") };
const W2 = { beforeAt: utc("14:15"), afterAt: utc("15:15") };
/** Every 15 minutes from `from` to `to`, both included. */
const grid = (from: string, to: string) => {
  const out: string[] = [];
  for (let t = utc(from).getTime(); t <= utc(to).getTime(); t += minutes(15))
    out.push(new Date(t).toISOString().slice(11, 16));
  return out;
};

/** Kills each member gained by `at`: 50 in window 1, 1,000 between the windows, 70 in window 2. */
const gainedBy = (at: Date) =>
  (at >= W1.afterAt ? 50 : 0) + (at >= W2.beforeAt ? 1000 : 0) + (at >= W2.afterAt ? 70 : 0);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

function context() {
  const t = testContext(db, ENV);
  t.ctx.v1 = fakeV1((id) => {
    const base = roster(id, new Date(t.clock.now.getTime() - minutes(1)));
    const members = base.members.map((m) => ({
      ...m,
      kills: m.kills === null ? null : m.kills + gainedBy(t.clock.now),
    }));
    return { ...base, members, totalKills: sumKills(members) };
  });
  return t;
}

async function tickAt(t: ReturnType<typeof testContext>, times: string[]) {
  const kinds: [string, TickOutcome["kind"]][] = [];
  for (const at of times) {
    t.clock.now = new Date(utc(at).getTime() + 20_000);
    kinds.push([at, (await runTick(t.ctx, db, ORIGIN)).kind]);
  }
  return kinds;
}

describe("a two-window event through the tick (D160)", () => {
  it("runs each window's Before, samples and After, and sums the windows' changes", async () => {
    const t = context();
    t.clock.now = utc("01:00");
    const event = await findOrCreateEvent(db, {
      name: "Origin of Chaos 2026-12-05",
      eventAtUtc: utc("02:10"),
      beforeAt: W1.beforeAt,
      afterAt: W2.afterAt,
      windows: [W1, W2],
    });

    const first = await tickAt(t, [...grid("02:00", "02:45"), "08:00"]);
    // Between the windows the event page waits for nothing, so no reading shows as late.
    const gap = await eventProgress(db, event.id, { now: utc("08:00"), everyMin: 15 });
    expect(gap).toMatchObject({ live: false, next: null, overdue: null, readings: 2 });
    const kinds = [...first, ...(await tickAt(t, grid("14:15", "15:15")))];

    expect(kinds.filter(([, k]) => k === "run").map(([at]) => at)).toEqual([
      "02:00",
      "02:45",
      "14:15",
      "15:15",
    ]);
    expect(kinds.filter(([, k]) => k === "sample").map(([at]) => at)).toEqual([
      "02:15",
      "02:30",
      "14:30",
      "14:45",
      "15:00",
    ]);
    expect(kinds.find(([at]) => at === "08:00")).toEqual(["08:00", "idle"]);
    const rows = await db
      .select({
        phase: snapshots.phase,
        window: snapshots.windowN,
        between: snapshots.betweenWindows,
        status: snapshots.status,
      })
      .from(snapshots)
      .where(eq(snapshots.eventId, event.id))
      .orderBy(asc(snapshots.startedAt));
    expect(rows.filter((r) => r.phase !== "sample")).toEqual([
      { phase: "before", window: 1, between: false, status: "complete" },
      { phase: "after", window: 1, between: true, status: "complete" },
      { phase: "before", window: 2, between: true, status: "complete" },
      { phase: "after", window: 2, between: false, status: "complete" },
    ]);
    expect(rows.filter((r) => r.phase === "sample").map((r) => r.window)).toEqual([1, 1, 2, 2, 2]);

    // Two members with kills each gained 50 + 70 in the windows; the 1,000 between them is not the event's.
    const { page } = await getEventPage(db, event.id, 45);
    const ledger = page?.movers.alliances?.killsGains ?? [];
    expect(ledger).toHaveLength(3);
    expect(ledger.every((m) => m.delta === 2 * (50 + 70))).toBe(true);
    const members = page?.movers.members?.killsGains ?? [];
    expect(members.map((m) => m.delta)).toEqual(Array(5).fill(50 + 70));
    // The alliance page's chain: the event's own change, read at its End.
    const [chain] = await allianceHistory(db, IDS[0] as number);
    expect(chain?.reference).toBe("after");
    expect(chain?.inEvent?.kills).toBe(240);
  });

  it("keeps quota for window 2's Before and After when window 1's Before starts", async () => {
    const t = context();
    t.ctx.v1 = fakeV1((id) => roster(id, new Date(t.clock.now.getTime() - minutes(1))), 99);
    const event = await findOrCreateEvent(db, {
      name: "Origin of Chaos 2026-12-05",
      eventAtUtc: utc("02:10"),
      beforeAt: W1.beforeAt,
      afterAt: W2.afterAt,
      windows: [W1, W2],
    });

    await tickAt(t, ["02:00"]);

    const [start] = await db
      .select({ status: snapshots.status, error: snapshots.error })
      .from(snapshots)
      .where(eq(snapshots.eventId, event.id));
    // 2 × 25 for window 1's Before and After, 2 × 25 for window 2's.
    expect(start).toEqual({ status: "failed", error: "quota: remaining 99 < required 100" });
  });

  it("posts the public message at the Start, edits it at the End only; edits the admin one per window end", async () => {
    const t = context();
    t.clock.now = utc("01:00");
    await findOrCreateEvent(db, {
      name: "Origin of Chaos 2026-12-05",
      eventAtUtc: utc("02:10"),
      beforeAt: W1.beforeAt,
      afterAt: W2.afterAt,
      windows: [W1, W2],
    });

    await tickAt(t, ["02:00"]);
    const publicPosts = () => t.posts.filter((p) => p.url === PUBLIC_WEBHOOK);
    const edits = (hook: string) => t.edits.filter((e) => e.url === hook);
    expect(publicPosts()).toHaveLength(1);
    expect(t.posts.filter((p) => p.url === ADMIN_WEBHOOK)).toHaveLength(1);

    await tickAt(t, ["02:45", "14:15"]);
    expect(edits(PUBLIC_WEBHOOK)).toHaveLength(0);
    expect(edits(ADMIN_WEBHOOK)).toHaveLength(1);

    drawn.length = 0;
    await tickAt(t, ["15:15"]);
    expect(publicPosts()).toHaveLength(1);
    expect(edits(PUBLIC_WEBHOOK)).toHaveLength(1);
    // The End's picture ranks the event's kills gained: +240 per alliance, not End − Start's +2,240.
    const end = drawn.at(-1) as EventImageInput;
    expect(topGains(end.alliances, end.before, "kills").map((g) => g.delta)).toEqual([
      240, 240, 240,
    ]);
    expect(edits(ADMIN_WEBHOOK)).toHaveLength(2);
    expect(t.posts.filter((p) => p.url === ADMIN_WEBHOOK)).toHaveLength(1);
  });
});
