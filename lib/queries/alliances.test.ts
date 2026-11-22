import { beforeAll, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb } from "../db.test-helpers";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import { allianceHistory } from "./alliances";

type Member = { uid: number; power: number; kills: number };

let db: Db;

beforeAll(async () => {
  db = await openTestDb();
});

const read = new Date("2026-10-24T12:00:00Z");
const m = (uid: number, power: number, kills: number): Member => ({ uid, power, kills });

/** One event of one alliance: its before and after rows, totals summed from the members. */
const seed = async (
  day: string,
  sides: Record<"before" | "after", [boolean, Member[]]>,
  unionId = 1,
) => {
  const at = new Date(`${day}T14:00:00Z`);
  const [event] = await db
    .insert(events)
    .values({
      name: `Saturday Event ${day}`,
      eventAtUtc: at,
      allianceIds: [unionId],
      beforeAt: at,
      afterAt: at,
    })
    .returning({ id: events.id });
  for (const phase of ["before", "after"] as const) {
    const [fresh, members] = sides[phase];
    const [snap] = await db
      .insert(snapshots)
      .values({
        eventId: (event as { id: number }).id,
        phase,
        startedAt: at,
        status: "complete",
      })
      .returning({ id: snapshots.id });
    const [row] = await db
      .insert(allianceSnapshots)
      .values({
        snapshotId: (snap as { id: number }).id,
        unionId,
        source: "v1",
        isFresh: fresh,
        sourceUpdatedAt: read,
        memberCount: members.length,
        totalPower: members.reduce((t, m) => t + m.power, 0),
        totalKills: members.reduce((t, m) => t + m.kills, 0),
        rawJson: {},
      })
      .returning({ id: allianceSnapshots.id });
    await db.insert(memberSnapshots).values(
      members.map((m) => ({
        allianceSnapshotId: (row as { id: number }).id,
        name: `P${m.uid}`,
        ...m,
      })),
    );
  }
};

describe("allianceHistory inEvent (#191)", () => {
  it("gives the before → after change with its leavers, and null when a side is stale", async () => {
    await seed("2026-10-24", {
      before: [true, [m(11, 100, 10), m(12, 20, 1)]],
      after: [true, [m(11, 90, 14), m(13, 5, 0)]],
    });
    await seed("2026-10-31", { before: [false, [m(11, 95, 15)]], after: [true, [m(11, 99, 15)]] });

    const [first, second] = await allianceHistory(db, 1);
    expect(first?.inEvent).toEqual({
      fromAt: read,
      fromPower: 120,
      fromKills: 11,
      power: -25,
      kills: 3,
      members: 0,
      left: 1,
    });
    expect(second?.inEvent).toBeNull();
  });
});

describe("allianceHistory step.members (issue 592)", () => {
  it("gives the member change between two fresh events, and null when the previous one is stale", async () => {
    const roster = (n: number, fresh: boolean): [boolean, Member[]] => [
      fresh,
      Array.from({ length: n }, (_, i) => m(200 + i, 10, 1)),
    ];
    const event = (day: string, n: number, fresh: boolean) =>
      seed(day, { before: roster(n, fresh), after: roster(n, fresh) }, 2);
    await event("2026-11-07", 3, true);
    await event("2026-11-14", 5, true);
    await event("2026-11-21", 4, false);
    await event("2026-11-28", 6, true);

    const history = await allianceHistory(db, 2);
    expect(history.map((r) => r.step.members)).toEqual([null, 2, null, null]);
  });
});
