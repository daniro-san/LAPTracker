import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import {
  allianceSnapshots,
  dailyReads,
  dailyRosters,
  events,
  memberSnapshots,
  snapshots,
} from "../schema";
import { mergePage } from "./merge";

let db: Db;
const TRACKED = [1, 2, 3, 4];
const at = (day: number, hour = 6) => new Date(Date.UTC(2026, 10, day, hour));

/** A member's might; the uid is the index + `from`. */
type Powers = (number | null)[];

/** One alliance's daily roster on `day`. */
async function daily(
  unionId: number,
  day: number,
  powers: Powers,
  o: { fresh?: boolean; from?: number } = {},
) {
  const key = `2026-11-${String(day).padStart(2, "0")}`;
  await db
    .insert(dailyReads)
    .values({ day: key, startedAt: at(day), status: "complete" })
    .onConflictDoNothing();
  const uids = powers.map((_, i) => (o.from ?? 1) + i);
  await db.insert(dailyRosters).values({
    readDay: key,
    unionId,
    tag: `T${unionId}`,
    name: `Alliance ${unionId}`,
    memberCount: powers.length,
    totalPower: powers.reduce<number>((t, p) => t + (p ?? 0), 0),
    sourceUpdatedAt: at(day),
    isFresh: o.fresh ?? true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: powers.map((p) => p as number),
    memberKills: uids.map(() => 0 as number),
  });
}

/** An event with a Start and an End on `day`; each alliance has a roster of `[uid, power, kills]` per side. */
async function event(
  day: number,
  rows: {
    unionId: number;
    capacity?: number;
    before: [number, number, number][];
    after: [number, number, number][];
  }[],
) {
  const [e] = await db
    .insert(events)
    .values({
      name: `Event ${day}`,
      eventAtUtc: at(day, 14),
      allianceIds: TRACKED,
      beforeAt: at(day, 12),
      afterAt: at(day, 16),
    })
    .returning({ id: events.id });
  for (const phase of ["before", "after"] as const) {
    const [s] = await db
      .insert(snapshots)
      .values({
        eventId: (e as { id: number }).id,
        phase,
        startedAt: at(day, 14),
        status: "complete",
      })
      .returning({ id: snapshots.id });
    for (const r of rows) {
      const members = r[phase];
      const [row] = await db
        .insert(allianceSnapshots)
        .values({
          snapshotId: (s as { id: number }).id,
          unionId: r.unionId,
          tag: `T${r.unionId}`,
          name: `Alliance ${r.unionId}`,
          memberCount: members.length,
          capacity: r.capacity ?? null,
          totalPower: members.reduce((t, m) => t + m[1], 0),
          source: "v1",
          sourceUpdatedAt: at(day, phase === "before" ? 12 : 16),
          isFresh: true,
        })
        .returning({ id: allianceSnapshots.id });
      await db.insert(memberSnapshots).values(
        members.map(([uid, power, kills]) => ({
          allianceSnapshotId: (row as { id: number }).id,
          uid,
          name: `P${uid}`,
          power,
          kills,
          lv: 1,
        })),
      );
    }
  }
}

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

describe("mergePage (#282)", () => {
  it("reads each alliance's newest usable roster: a stale newer one is skipped, the newer kind wins", async () => {
    await daily(1, 10, [10, 10]);
    await daily(1, 12, [99], { fresh: false });
    await daily(2, 10, [5]);
    await event(11, [{ unionId: 2, before: [[1, 7, 0]], after: [[1, 8, 0]] }]);
    const page = await mergePage(db, [1, 2], TRACKED);
    const { a, b } = page.merge ?? ({} as never);
    expect([a.power, a.at]).toEqual([20, at(10)]);
    expect([b.power, b.at]).toEqual([8, at(11, 16)]);
  });

  it("holds the merged alliance to the larger stored capacity and places it among the others", async () => {
    await daily(1, 10, [40, 30, 20]);
    await daily(2, 10, [50, 10], { from: 10 });
    await daily(3, 10, [100, 45]);
    await daily(4, 10, [60]);
    await event(9, [
      { unionId: 1, capacity: 3, before: [[1, 1, 0]], after: [[1, 1, 0]] },
      { unionId: 2, capacity: 4, before: [[10, 1, 0]], after: [[10, 1, 0]] },
    ]);
    const r = (await mergePage(db, [1, 2], TRACKED)).merge?.result;
    expect(r).toMatchObject({ capacity: 4, members: 5, within: 4, leftOut: 1, overCap: true });
    expect([r?.mightAll, r?.mightWithin, r?.mightLeftOut]).toEqual([150, 140, 10]);
    expect([r?.rankAll, r?.rankWithin]).toEqual([1, 2]);
  });

  it("shows each side's latest turnout and no member name", async () => {
    await daily(1, 10, [1]);
    await daily(2, 10, [1], { from: 10 });
    await event(8, [
      {
        unionId: 1,
        before: [
          [1, 1, 0],
          [2, 1, 0],
        ],
        after: [
          [1, 1, 5],
          [2, 1, 0],
        ],
      },
      { unionId: 2, before: [[10, 1, 0]], after: [[10, 1, 0]] },
    ]);
    await event(9, [
      {
        unionId: 2,
        before: [
          [10, 1, 0],
          [11, 1, 0],
        ],
        after: [
          [10, 1, 3],
          [11, 1, 4],
        ],
      },
    ]);
    const page = await mergePage(db, [1, 2], TRACKED);
    expect(page.merge?.a.turnout).toMatchObject({ n: 2, gainers: 1 });
    expect(page.merge?.b.turnout).toMatchObject({ n: 2, gainers: 2 });
    expect(JSON.stringify(page)).not.toMatch(/"P\d/);
    // While the war-turnout flag is off (D91) no side has a turnout.
    const off = await mergePage(db, [1, 2], TRACKED, undefined, Promise.resolve(false));
    expect([off.merge?.a.turnout, off.merge?.b.turnout]).toEqual([null, null]);
  });

  it("gives no merge for the same alliance twice or an alliance with no usable roster", async () => {
    await daily(1, 10, [1]);
    expect((await mergePage(db, [1, 1], TRACKED)).merge).toBeNull();
    expect((await mergePage(db, [1, 9], TRACKED)).merge).toBeNull();
  });
});
