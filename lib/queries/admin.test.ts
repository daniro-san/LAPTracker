import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { allianceSnapshots, events, snapshots } from "../schema";
import { getRun, listRuns, runTrace } from "./admin";

const START = new Date("2026-11-07T12:00:00Z");
const at = (seconds: number) => new Date(START.getTime() + seconds * 1000);

describe("runTrace", () => {
  it("counts the quota call's retries on its row and in the total", () => {
    const logs = [
      { id: 1, at: at(1), code: "v1.retry", unionId: null, data: { retry_n: 1 } },
      { id: 2, at: at(2), code: "v1.retry", unionId: null, data: { retry_n: 2 } },
      { id: 3, at: at(3), code: "v1.fetch", unionId: null, data: { endpoint: "quota" } },
      { id: 4, at: at(4), code: "v1.retry", unionId: 7, data: { retry_n: 1 } },
      { id: 5, at: at(5), code: "v1.fetch", unionId: 7, data: { endpoint: "alliance" } },
    ];

    const trace = runTrace(logs, new Map([[7, "A7"]]), START);

    expect(trace.calls.map((c) => [c.endpoint, c.retries])).toEqual([
      ["quota", 2],
      ["alliance", 1],
    ]);
    expect(trace.total.retries).toBe(3);
  });
});

describe("runProblems", () => {
  let db: Db;
  let id: number;
  beforeAll(async () => {
    db = await openTestDb();
    const [event] = await db
      .insert(events)
      .values({
        name: "E",
        eventAtUtc: START,
        allianceIds: [1, 2, 3],
        beforeAt: START,
        afterAt: START,
      })
      .returning({ id: events.id });
    const [snap] = await db
      .insert(snapshots)
      .values({
        eventId: (event as { id: number }).id,
        phase: "after",
        startedAt: START,
        status: "partial",
      })
      .returning({ id: snapshots.id });
    id = (snap as { id: number }).id;
    const row = { snapshotId: id, source: "v1" as const, rawJson: { members: [{ uid: 1, x: 1 }] } };
    await db.insert(allianceSnapshots).values([
      { ...row, unionId: 1, tag: "OK", isFresh: true },
      { ...row, unionId: 2, tag: "OLD", name: "Old", isFresh: false },
      { ...row, unionId: 3, tag: "BAD", isFresh: false, error: "HTTP 500" },
    ]);
  });

  it("names the stale and the failed alliance of a run, and nothing else about them", async () => {
    const found = await getRun(db, id);
    expect(found?.problems).toEqual([
      { snapshotId: id, unionId: 2, tag: "OLD", name: "Old", failed: false },
      { snapshotId: id, unionId: 3, tag: "BAD", name: null, failed: true },
    ]);
    expect((await listRuns(db))[0]?.problems).toHaveLength(2);
  });
});
