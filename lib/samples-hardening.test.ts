// Hardening of the event samples for their first real run (D69, amended 2026-11-16) on PGlite.
import { asc } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { testContext, TEST_ENV } from "./app-context.test-helpers";
import { ago, fakeV1, IDS, minutes, roster } from "./collector.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { failedSampleUnionIds } from "./repo/alliance-snapshots";
import { dueSample } from "./repo/events";
import { executeSample, SAMPLE_NOTIFY_CAP_MS } from "./run";
import { snapshots } from "./schema";
import { runTick } from "./tick";

// The Before's picture (D58) is drawn by a real renderer that takes seconds under load; not what these tests are about.
vi.mock("./event-image", () => ({ eventImage: async () => new Uint8Array([1]) }));

const KVK = { ...TEST_ENV, SNAPSHOT_AFTER: "16:15", SAMPLE_EVERY_MIN: 15 };
const ORIGIN = "https://laptracker.test";
const utc = (hhmm: string) => new Date(`2026-11-07T${hhmm}:00Z`);

/** Two ticks of 20 alliances on PGlite: 0.3 s alone, about 10 times that at load average 40. A test that times out
 * leaves its ticks running on the shared database, and the next test's truncateAll then removes the event its
 * sample is looking for (a TypeError in executeSample, 2026-11-16), so the timeout must not be near. */
vi.setConfig({ testTimeout: 30_000 });

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

/** Ticks at each time, 20 s after it (cron-job.org starts late). */
async function tickAt(ctx: ReturnType<typeof testContext>, times: string[]) {
  for (const t of times) {
    ctx.clock.now = new Date(utc(t).getTime() + 20_000);
    await runTick(ctx.ctx, db, ORIGIN);
  }
}

describe("event sample hardening (D69)", () => {
  it("names the alliances that failed in a sample of the event, and not those that failed in the Before", async () => {
    const t = testContext(db, KVK);
    const [inBefore, inSample] = IDS as [number, number];
    t.ctx.v1 = fakeV1((id) =>
      id === inBefore ? new Error("timeout") : roster(id, ago(t.clock.now, minutes(1))),
    );
    await tickAt(t, ["12:00"]);
    t.ctx.v1 = fakeV1((id) =>
      id === inSample ? new Error("timeout") : roster(id, ago(t.clock.now, minutes(1))),
    );
    await tickAt(t, ["12:15", "12:30"]);

    expect(await failedSampleUnionIds(db, 1)).toEqual([inSample]);
    expect(await failedSampleUnionIds(db, 2)).toEqual([]);
  });

  it("answers a sample's tick by 28 s even when the admin message hangs", async () => {
    const t = testContext(db, KVK);
    await tickAt(t, ["12:00"]);
    const slotAt = utc("12:15");
    t.clock.now = new Date(slotAt.getTime() + 20_000);
    const event = await dueSample(db, slotAt);
    if (!event) throw new Error("no sample is due: the Before's tick did not leave the event");
    // The last read moves the clock to 27.9 s into the run, so the notify step has 100 ms.
    const last = IDS[IDS.length - 1];
    const startedAt = t.clock.now;
    t.ctx.v1 = fakeV1((id) => {
      if (id === last) t.clock.now = new Date(startedAt.getTime() + SAMPLE_NOTIFY_CAP_MS - 100);
      return id === IDS[0] ? new Error("timeout") : roster(id, ago(startedAt, minutes(1)));
    });
    t.ctx.fetch = () => new Promise(() => {});

    const outcome = await executeSample(t.ctx, db, {
      event,
      slotAt,
      origin: ORIGIN,
    });

    expect(outcome).toMatchObject({ ok: true, summary: { status: "partial" } });
  });

  it("samples only the slot holding now after a gap, never the slots no tick took", async () => {
    await tickAt(testContext(db, KVK), ["12:00", "12:50"]);

    const rows = await db
      .select({ phase: snapshots.phase, slotAt: snapshots.slotAt })
      .from(snapshots)
      .orderBy(asc(snapshots.id));
    expect(rows.map((r) => [r.phase, r.slotAt?.toISOString().slice(11, 16) ?? null])).toEqual([
      ["before", null],
      ["sample", "12:45"],
    ]);
  });
});
