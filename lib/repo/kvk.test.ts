// The KvK opponent's claim and answer on Postgres (D152, INVARIANT kvk.one-call-per-row), through the real
// repo on PGlite: one claim per (opponent, phase, tag), the answer over that row only, and a claim with no
// answer counted as done. Invented tags of an invented server 326.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { SENT } from "../collector-opponent";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { opponentDue } from "../kvk";
import { events, snapshots } from "../schema";
import { createRepo, type OpponentRead } from "./index";
import { opponentReads, saveOpponent } from "./kvk";

const WAR = new Date("2026-11-28T14:00:00Z"); // Sat 12:00 ST
const START = new Date("2026-11-28T12:01:00Z"); // Sat 10:01 ST

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
});

/** The scheduled event at WAR with its Start row, and an opponent with `tags`. */
async function seed(tags: string[]) {
  const [event] = await db
    .insert(events)
    .values({
      name: "Saturday Event 2026-11-28",
      eventAtUtc: WAR,
      allianceIds: [],
      beforeAt: START,
      afterAt: WAR,
    })
    .returning({ id: events.id });
  expect(await saveOpponent(db, { eventAt: WAR, server: 326, tags }, START)).toBeNull();
  const [snap] = await db
    .insert(snapshots)
    .values({ eventId: event?.id ?? 0, phase: "before", startedAt: START, status: "running" })
    .returning({ id: snapshots.id });
  const repo = createRepo(db);
  const o = await repo.opponentFor(event?.id ?? 0);
  if (!o) throw new Error("no opponent");
  return { repo, o, snapshotId: snap?.id ?? 0 };
}

/** A claim as the collector writes it before the call. */
const claimOf = (opponentId: number, snapshotId: number, tag: string): OpponentRead => ({
  opponentId,
  snapshotId,
  phase: "before",
  tag,
  unionId: null,
  sid: null,
  name: null,
  memberCount: null,
  totalPower: null,
  totalKills: null,
  memberUids: null,
  memberPower: null,
  memberKills: null,
  sourceUpdatedAt: null,
  cached: null,
  isFresh: false,
  error: SENT,
  readAt: START,
});

describe("the opponent's claims on Postgres (D152)", () => {
  it("claims a tag once per phase, and a second claim of it is refused", async () => {
    const { repo, o, snapshotId } = await seed(["AAA"]);
    const claim = claimOf(o.id, snapshotId, "AAA");
    expect(await repo.insertOpponentRead(claim)).toBe(true);
    expect(await repo.insertOpponentRead({ ...claim, readAt: WAR })).toBe(false);
    // The End's claim of the same tag is its own row.
    expect(await repo.insertOpponentRead({ ...claim, phase: "after" })).toBe(true);
    const rows = await opponentReads(db, [o.id]);
    expect(rows.map((r) => [r.phase, r.tag, r.readAt.toISOString()])).toEqual([
      ["before", "AAA", START.toISOString()],
      ["after", "AAA", START.toISOString()],
    ]);
  });

  it("writes the answer over its own claim only", async () => {
    const { repo, o, snapshotId } = await seed(["AAA", "BBB"]);
    await repo.insertOpponentRead(claimOf(o.id, snapshotId, "AAA"));
    await repo.insertOpponentRead(claimOf(o.id, snapshotId, "BBB"));
    await repo.updateOpponentRead({
      ...claimOf(o.id, snapshotId, "AAA"),
      unionId: 990301,
      sid: 326,
      name: "Quiet Zephyr",
      memberCount: 2,
      totalPower: 101_000_000,
      totalKills: 3_000_000,
      memberUids: [9903010, 9903011],
      memberPower: [61_000_000, null],
      memberKills: [2_000_000, 1_000_000],
      isFresh: true,
      error: null,
    });
    const rows = await opponentReads(db, [o.id]);
    expect(rows.find((r) => r.tag === "AAA")).toMatchObject({
      unionId: 990301,
      error: null,
      memberPower: [61_000_000, null],
    });
    expect(rows.find((r) => r.tag === "BBB")).toMatchObject({ unionId: null, error: SENT });
  });

  it("counts a claim with no answer as done, so its tag is never due again", async () => {
    const { repo, o, snapshotId } = await seed(["AAA", "BBB"]);
    await repo.insertOpponentRead(claimOf(o.id, snapshotId, "AAA"));
    const due = opponentDue(o, await repo.opponentReads(o.id), "before");
    expect(due.map((d) => d.tag)).toEqual(["BBB"]);
  });
});
