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
import { playerProgress } from "./player-progress";

type Member = [uid: number, power: number];

const at = (day: string, time = "08:01") => new Date(`${day}T${time}:00Z`);

async function daily(db: Db, day: string, members: Member[], isFresh = true) {
  await db.insert(dailyReads).values({ day, startedAt: at(day), status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: 1,
    tag: "OGs",
    memberCount: members.length,
    sourceUpdatedAt: at(day),
    isFresh,
    memberUids: members.map((m) => m[0]),
    memberNames: members.map((m) => `P${m[0]}`),
    memberPower: members.map((m) => m[1]),
    memberKills: members.map(() => 5),
  });
}

/** An event on `day` with a Start at 10:00 and an End at 14:00, alliance 1 only. */
async function event(db: Db, day: string, isTest: boolean, rosters: [Member[], Member[]]) {
  const [ev] = await db
    .insert(events)
    .values({
      name: `Saturday Event ${day}`,
      eventAtUtc: at(day, "12:00"),
      allianceIds: [1],
      beforeAt: at(day, "10:00"),
      afterAt: at(day, "14:00"),
      isTest,
    })
    .returning({ id: events.id });
  for (const [i, phase] of (["before", "after"] as const).entries()) {
    const time = at(day, phase === "before" ? "10:00" : "14:00");
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId: (ev as { id: number }).id, phase, startedAt: time, status: "complete" })
      .returning({ id: snapshots.id });
    const members = rosters[i] as Member[];
    const [row] = await db
      .insert(allianceSnapshots)
      .values({
        snapshotId: (snap as { id: number }).id,
        unionId: 1,
        tag: "OGs",
        source: "v1",
        isFresh: true,
        memberCount: members.length,
        sourceUpdatedAt: time,
        rawJson: {},
      })
      .returning({ id: allianceSnapshots.id });
    await db.insert(memberSnapshots).values(
      members.map(([uid, power]) => ({
        allianceSnapshotId: (row as { id: number }).id,
        uid,
        name: `P${uid}`,
        power,
        kills: 5,
      })),
    );
  }
}

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
  await daily(db, "2026-11-01", [
    [7, 100],
    [8, 200],
    [9, 50],
  ]);
  await daily(db, "2026-11-02", [[7, 999]], false);
  await event(db, "2026-11-06", true, [[[7, 1]], [[7, 2]]]);
  await event(db, "2026-11-07", false, [
    [
      [7, 105],
      [8, 210],
    ],
    [
      [7, 90],
      [8, 190],
    ],
  ]);
  await daily(db, "2026-11-08", [
    [7, 220],
    [8, 210],
    [9, 52],
  ]);
});

describe("playerProgress (issue 270)", () => {
  it("merges daily and public event readings oldest first, skipping a stale roster and a test event", async () => {
    const { readings } = await playerProgress(db, 7);

    expect(readings.map((r) => [r.at, r.event?.phase ?? "daily", r.power])).toEqual([
      [at("2026-11-01"), "daily", 100],
      [at("2026-11-07", "10:00"), "before", 105],
      [at("2026-11-07", "14:00"), "after", 90],
      [at("2026-11-08"), "daily", 220],
    ]);
  });

  it("ranks the player by might inside each roster", async () => {
    const { readings } = await playerProgress(db, 7);

    expect(readings.map((r) => r.rank)).toEqual([2, 2, 2, 1]);
  });

  it("compares the newest reading with the newest one 7 days older, next to the alliance's median member", async () => {
    const { summary } = await playerProgress(db, 7);

    expect(summary?.from.at).toEqual(at("2026-11-01"));
    expect(summary?.to.at).toEqual(at("2026-11-08"));
    expect(summary?.power).toBe(120);
    // Members in both rosters: +120 %, +5 %, +4 %.
    expect(summary?.alliance).toEqual({ unionId: 1, tag: "OGs", medianPercent: 5 });
    expect((await playerProgress(db, 404)).summary).toBeNull();
  });
});
