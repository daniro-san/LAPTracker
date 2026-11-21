// The live section's shared cache (issue 327) and the event's shared reads (D143, issue 538) through the tick
// on PGlite, with the in-memory caches of lib/app-context.test-helpers.ts in place of Next's (which needs a
// Next request).
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { ago, fakeV1, minutes, roster } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { getEventDetail } from "@/lib/queries";
import { events } from "@/lib/schema";
import { runTick } from "@/lib/tick";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
// The Before's public message draws a picture (D58), seconds under load; not what these tests are about.
vi.mock("@/lib/event-image", () => ({ eventImage: async () => new Uint8Array([1]) }));
// The page's connection is closed in `after`, which needs a Next request; every war section's flag is on.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: () => undefined,
}));
vi.mock("@/lib/flags", () => ({ isOn: async () => true }));

const { loadEventPage, loadProgress } = await import("./event-page");

// A Saturday with Before at 12:00 UTC and a sample every 15 minutes (as lib/samples.test.ts).
const KVK = { ...TEST_ENV, SNAPSHOT_AFTER: "16:15", SAMPLE_EVERY_MIN: 15 };
const utc = (hhmm: string) => new Date(`2026-11-07T${hhmm}:00Z`);
vi.setConfig({ testTimeout: 30_000 });

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

/** The tick at each time (20 s after it); returns the context and the event's id. */
async function ticked(times: string[]) {
  const t = testContext(db, KVK);
  holder.ctx = t.ctx;
  for (const hhmm of times) {
    t.clock.now = new Date(utc(hhmm).getTime() + 20_000);
    await runTick(t.ctx, db, "https://laptracker.test");
  }
  const [event] = await db.select({ id: events.id }).from(events);
  return { t, id: (event as { id: number }).id };
}

type Detail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;
const detailOf = async (id: number) => (await getEventDetail(db, id)) as Detail;
const progressAt = async (id: number, hhmm: string) => loadProgress(await detailOf(id), utc(hhmm));

describe("loadProgress through the event cache", () => {
  it("reads the event's rows from the database once for two reads, and computes each at its own now", async () => {
    const { id } = await ticked(["12:00", "12:15"]);
    const selects = vi.spyOn(db, "select");
    const detail = await detailOf(id);
    selects.mockClear();

    const first = await loadProgress(detail, utc("12:16"));
    const second = await loadProgress(detail, utc("12:17"));

    expect(selects).toHaveBeenCalledTimes(1);
    expect(second?.readings).toBe(1);
    expect(second?.standings).toEqual(first?.standings);
    expect([first?.asOf, second?.asOf]).toEqual([utc("12:16"), utc("12:17")]);
    selects.mockRestore();
  });

  it("drops the entry when the tick stores a sample, so the next read shows it", async () => {
    const { t, id } = await ticked(["12:00", "12:15"]);
    expect((await progressAt(id, "12:16"))?.readings).toBe(1);

    t.clock.now = new Date(utc("12:30").getTime() + 20_000);
    expect((await runTick(t.ctx, db, "https://laptracker.test")).kind).toBe("sample");

    expect((await progressAt(id, "12:31"))?.readings).toBe(2);
  });
});

describe("loadEventPage through the public cache (D143, issue 538)", () => {
  it("reads the event once for two views, and the first view after a sample shows it", async () => {
    const { t, id } = await ticked(["12:00", "12:15"]);
    const selects = vi.spyOn(db, "select");
    const first = await loadEventPage(id);
    selects.mockClear();

    const second = await loadEventPage(id);
    expect(selects).not.toHaveBeenCalled();
    expect(second).toEqual(first);
    expect(second.page?.ranks).toBeInstanceOf(Map);
    expect(first.page?.turnout).toBeNull();

    // The 12:30 sample: every member with kills gained 50.
    t.clock.now = new Date(utc("12:30").getTime() + 20_000);
    t.ctx.v1 = fakeV1((uid) => {
      const r = roster(uid, ago(t.clock.now, minutes(1)));
      return { ...r, members: r.members.map((m) => ({ ...m, kills: m.kills && m.kills + 50 })) };
    });
    expect((await runTick(t.ctx, db, "https://laptracker.test")).kind).toBe("sample");

    const after = await loadEventPage(id);
    expect(after.page?.turnout?.soFar).toBe(true);
    expect(after.page?.turnout?.withKills[0]?.gainers).toBe(2);
    selects.mockRestore();
  });

  it("answers an id that is not a public event from the shared list, with no read of its own", async () => {
    const { id } = await ticked(["12:00"]);
    await loadEventPage(id);
    const selects = vi.spyOn(db, "select");

    expect((await loadEventPage(id + 1000)).page).toBeNull();
    expect(selects).not.toHaveBeenCalled();
    selects.mockRestore();
  });
});
