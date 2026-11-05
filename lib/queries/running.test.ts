import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { events, snapshots } from "../schema";
import { runningSnapshots } from "./admin";

const NOW = new Date("2026-11-05T20:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

async function add(minutesAgo: number, status: "running" | "complete", manual = false) {
  const at = ago(minutesAgo);
  const [event] = await db
    .insert(events)
    .values({ name: "Round", eventAtUtc: at, allianceIds: [], beforeAt: at, afterAt: at, manual })
    .returning({ id: events.id });
  await db
    .insert(snapshots)
    .values({ eventId: (event as { id: number }).id, phase: "before", startedAt: at, status });
}

describe("runningSnapshots", () => {
  it("lists a live run, and ignores finished runs and a run abandoned for over 10 minutes", async () => {
    await add(1, "running", true);
    await add(2, "complete");
    await add(30, "running");

    const rows = await runningSnapshots(db, NOW);

    expect(rows.map((r) => [r.eventName, r.phase, r.manual])).toEqual([["Round", "before", true]]);
  });
});
