import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { seed } from "./seed";
import type { Db } from "../lib/db";
import { openTestDb, truncateAll } from "../lib/db.test-helpers";
import { events, snapshots } from "../lib/schema";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

const states = async () => {
  const evs = await db.select().from(events);
  const snaps = await db.select().from(snapshots);
  const withSnaps = (id: number) => snaps.filter((s) => s.eventId === id);
  return {
    empty: evs.filter((e) => withSnaps(e.id).length === 0),
    running: evs.filter((e) =>
      withSnaps(e.id).some((s) => s.phase === "after" && s.status === "running"),
    ),
  };
};

// Each body runs a whole seed on PGlite, far heavier than the bodies the global testTimeout was sized
// on (#124): 15.0 s in a full `pnpm check` on a 10-core Mac at load average 36-44 (2026-11-11); 4x that.
describe("seed --with-states", { timeout: 60_000 }, () => {
  it("adds an event a week ahead with no snapshots and an event whose After is running", async () => {
    await seed(db, { withStates: true });
    const { empty, running } = await states();
    expect(empty).toHaveLength(1);
    expect((empty[0] as { eventAtUtc: Date }).eventAtUtc.getTime()).toBeGreaterThan(Date.now());
    expect(running).toHaveLength(1);
  });

  it("is off by default", async () => {
    await seed(db);
    const { empty, running } = await states();
    expect(empty).toHaveLength(0);
    expect(running).toHaveLength(0);
  });
});
