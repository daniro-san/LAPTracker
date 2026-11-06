import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { allianceSnapshots, events, snapshots } from "../schema";
import { getUpstreamStatus } from "./upstream-status";

const NOW = new Date("2026-11-05T20:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

type Row = { error?: string; fresh?: boolean; updatedAt?: Date };
async function addRun(
  startedMinutesAgo: number,
  run: { status: "running" | "complete" | "partial" | "failed"; error?: string; isTest?: boolean },
  rows: Row[] = [],
) {
  const at = ago(startedMinutesAgo);
  const [event] = await db
    .insert(events)
    .values({
      name: "Scheduled event",
      eventAtUtc: at,
      allianceIds: [1],
      beforeAt: at,
      afterAt: at,
      isTest: run.isTest ?? false,
    })
    .returning({ id: events.id });
  const [snap] = await db
    .insert(snapshots)
    .values({
      eventId: (event as { id: number }).id,
      phase: "before",
      startedAt: at,
      status: run.status,
      error: run.error ?? null,
    })
    .returning({ id: snapshots.id });
  if (rows.length === 0) return;
  await db.insert(allianceSnapshots).values(
    rows.map((r, i) => ({
      snapshotId: (snap as { id: number }).id,
      unionId: i + 1,
      source: "v1" as const,
      isFresh: r.fresh ?? r.error === undefined,
      error: r.error ?? null,
      sourceUpdatedAt: r.updatedAt ?? null,
    })),
  );
}

describe("getUpstreamStatus (D27)", () => {
  it("is not down when there is no run, or the latest run completed", async () => {
    expect(await getUpstreamStatus(db, NOW)).toEqual({ down: false });
    await addRun(30, { status: "complete" }, [{ updatedAt: ago(30) }]);
    expect(await getUpstreamStatus(db, NOW)).toEqual({ down: false });
  });

  it("is down when the latest run closed at the deadline, and names the last fresh time", async () => {
    await addRun(600, { status: "complete" }, [{ updatedAt: ago(590) }]);
    await addRun(30, { status: "partial", error: "deadline" });
    expect(await getUpstreamStatus(db, NOW)).toEqual({ down: true, lastFreshAt: ago(590) });
  });

  it("is down when half the rows or more failed with a 5xx or a timeout", async () => {
    await addRun(30, { status: "failed" }, [{ error: "http 504" }, { error: "TimeoutError" }]);
    expect(await getUpstreamStatus(db, NOW)).toMatchObject({ down: true });
  });

  it("is not down for failures the upstream did not cause (404, quota) or for a few 5xx", async () => {
    await addRun(30, { status: "failed" }, [
      { error: "not found" },
      { error: "quota exhausted (429)" },
    ]);
    expect(await getUpstreamStatus(db, NOW)).toEqual({ down: false });
    await truncateAll(db);
    await addRun(30, { status: "partial" }, [{ error: "http 504" }, {}, {}, {}]);
    expect(await getUpstreamStatus(db, NOW)).toEqual({ down: false });
  });

  it("is down for a run still running past the run lock, not for one just started", async () => {
    await addRun(1, { status: "running" });
    expect(await getUpstreamStatus(db, NOW)).toEqual({ down: false });
    await truncateAll(db);
    await addRun(60, { status: "running" });
    expect(await getUpstreamStatus(db, NOW)).toMatchObject({ down: true });
  });

  it("clears when a newer run completes, ignores rehearsals, and ages out after 24 hours", async () => {
    await addRun(120, { status: "partial", error: "deadline" });
    await addRun(10, { status: "complete" }, [{ updatedAt: ago(10) }]);
    expect(await getUpstreamStatus(db, NOW)).toEqual({ down: false });
    await truncateAll(db);
    await addRun(120, { status: "partial", error: "deadline" });
    await addRun(10, { status: "complete", isTest: true });
    expect(await getUpstreamStatus(db, NOW)).toMatchObject({ down: true });
    await truncateAll(db);
    await addRun(25 * 60, { status: "partial", error: "deadline" });
    expect(await getUpstreamStatus(db, NOW)).toEqual({ down: false });
  });
});
