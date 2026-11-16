// The live section's shared cache (issue 327) through the tick on PGlite, with the in-memory event cache
// of lib/app-context.test-helpers.ts in place of Next's (which needs a Next request).
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
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

const { loadProgress } = await import("./event-page");

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
