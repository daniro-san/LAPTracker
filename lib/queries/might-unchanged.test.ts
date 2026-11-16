import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import {
  allianceSnapshots,
  dailyReads,
  dailyRosters,
  events,
  memberSnapshots,
  snapshots,
} from "../schema";
import { mightUnchanged } from "./might-unchanged";

/** uid → [might, kills] */
type Roster = Record<number, [number | null, number]>;

const DAY = 86_400_000;
const START = Date.UTC(2026, 9, 1, 8, 1); // 2026-10-01 08:01
const at = (n: number) => new Date(START + n * DAY);
const dayOf = (n: number) => at(n).toISOString().slice(0, 10);

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});

/** One usable daily read of `unionId`, `n` days after the start. */
async function daily(unionId: number, n: number, roster: Roster) {
  const uids = Object.keys(roster).map(Number);
  await db
    .insert(dailyReads)
    .values({ day: dayOf(n), startedAt: at(n), status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: dayOf(n),
    unionId,
    tag: "T",
    name: `Alliance ${unionId}`,
    memberCount: uids.length,
    sourceUpdatedAt: at(n),
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map((u) => roster[u]?.[0] ?? null) as number[],
    memberKills: uids.map((u) => roster[u]?.[1] ?? 0),
  });
}

/** One public event roster of `unionId`, `n` days after the start. */
async function eventRoster(unionId: number, n: number, roster: Roster) {
  const [event] = await db
    .insert(events)
    .values({
      name: `Event ${n}`,
      eventAtUtc: at(n),
      allianceIds: [unionId],
      beforeAt: at(n),
      afterAt: at(n),
    })
    .returning({ id: events.id });
  const [snap] = await db
    .insert(snapshots)
    .values({
      eventId: (event as { id: number }).id,
      phase: "after",
      startedAt: at(n),
      status: "complete",
    })
    .returning({ id: snapshots.id });
  const uids = Object.keys(roster).map(Number);
  const [alliance] = await db
    .insert(allianceSnapshots)
    .values({
      snapshotId: (snap as { id: number }).id,
      unionId,
      tag: "T",
      source: "v1",
      isFresh: true,
      memberCount: uids.length,
      sourceUpdatedAt: at(n),
    })
    .returning({ id: allianceSnapshots.id });
  await db.insert(memberSnapshots).values(
    uids.map((uid) => ({
      allianceSnapshotId: (alliance as { id: number }).id,
      uid,
      name: `P${uid}`,
      lv: 1,
      power: roster[uid]?.[0] ?? null,
      kills: roster[uid]?.[1] ?? 0,
    })),
  );
}

/** Daily reads on days `from..to` (inclusive), each roster built by `make(day)`. */
async function dailies(unionId: number, from: number, to: number, make: (n: number) => Roster) {
  for (let n = from; n <= to; n++) await daily(unionId, n, make(n));
}

describe("mightUnchanged (D70)", () => {
  it("lists a member whose might held in every read, with the days and the kills gained, and skips one that changed", async () => {
    // 16 daily reads: Ana never changes; Bo changes on day 12, so his run has only 4 daily reads.
    await dailies(1, 0, 15, (n) => ({ 1: [500, 10 + n], 2: [n < 12 ? 300 : 310, 0] }));

    const view = await mightUnchanged(db, 1);

    expect(view.ready).toBe(true);
    expect(view.unchanged).toEqual([{ uid: 1, name: "P1", might: 500, days: 15, killsChange: 15 }]);
  });

  it("breaks the run at an event roster where the might changed", async () => {
    // Daily reads on days 0-15 with the same might; an event roster on day 12 (between two reads) differs.
    await dailies(2, 0, 11, () => ({ 1: [500, 0], 2: [500, 0] }));
    await eventRoster(2, 11.5, { 1: [500, 0], 2: [520, 0] });
    await dailies(2, 12, 15, () => ({ 1: [500, 0], 2: [500, 0] }));

    const view = await mightUnchanged(db, 2);

    // Member 2's run is the 4 daily reads after the event, so it is under 7 and he is not listed.
    expect(view.unchanged.map((r) => r.uid)).toEqual([1]);
    expect(view.period?.events).toBe(1);
  });

  it("leaves out a member first seen in the alliance less than 14 days before the newest read", async () => {
    // 9 daily reads (8 days). Everyone first appears in the oldest read, 8 days before the newest.
    await dailies(3, 0, 8, () => ({ 1: [500, 0] }));
    expect((await mightUnchanged(db, 3)).unchanged).toEqual([]);

    // Seven more reads: the oldest read is now 15 days back and the member is listed.
    await dailies(3, 9, 15, () => ({ 1: [500, 0] }));
    expect((await mightUnchanged(db, 3)).unchanged.map((r) => r.uid)).toEqual([1]);
  });

  it("is not ready with fewer than 7 daily reads and says how many there are", async () => {
    await dailies(4, 0, 4, () => ({ 1: [500, 0] }));

    const view = await mightUnchanged(db, 4);

    expect(view).toMatchObject({ ready: false, dailyReads: 5, unchanged: [], lost: [] });
  });

  it("lists a member who lost 5 % or more over the newest 7 daily reads, biggest first, and not 4.9 %", async () => {
    // The span starts at day 9 (the 7th newest of 16). Might at day 9, then at day 15:
    // uid 1: 1000 → 900 (10 %), uid 2: 1000 → 950 (5 %), uid 3: 1000 → 951 (4.9 %), uid 4: 1000 → 1100.
    await dailies(5, 0, 15, (n) => {
      const late = n >= 15;
      return {
        1: [late ? 900 : 1000, 0],
        2: [late ? 950 : 1000, 3],
        3: [late ? 951 : 1000, 0],
        4: [late ? 1100 : 1000, 0],
      };
    });

    const view = await mightUnchanged(db, 5);

    expect(view.lost).toEqual([
      { uid: 1, name: "P1", might: 900, mightChange: -100, pct: 10, killsChange: 0 },
      { uid: 2, name: "P2", might: 950, mightChange: -50, pct: 5, killsChange: 0 },
    ]);
    expect(view.period).toMatchObject({ from: at(9), to: at(15), daily: 7 });
  });
});
