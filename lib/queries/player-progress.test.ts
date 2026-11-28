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
import { findBlockedKeys } from "./blocked-keys";
import { playerProgress, progressSteps, type ProgressReading } from "./player-progress";

type Member = [uid: number, power: number];

const at = (day: string, time = "08:01") => new Date(`${day}T${time}:00Z`);

async function daily(
  db: Db,
  day: string,
  members: Member[],
  isFresh = true,
  [unionId, tag]: [number, string] = [1, "OGs"],
) {
  await db.insert(dailyReads).values({ day, startedAt: at(day), status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    tag,
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
  // The summary's edge cases: player 20 moves from TRI to TmS; player 30 has two readings 2 days apart.
  await daily(
    db,
    "2026-10-20",
    [
      [20, 50],
      [30, 60],
    ],
    true,
    [2, "TRI"],
  );
  await daily(db, "2026-10-22", [[30, 66]], true, [2, "TRI"]);
  await daily(db, "2026-10-28", [[20, 55]], true, [3, "TmS"]);
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

  it("leaves out the alliance median when the two readings are of different alliances", async () => {
    const { summary } = await playerProgress(db, 20);

    expect([summary?.from.at, summary?.to.at, summary?.power]).toEqual([
      at("2026-10-20"),
      at("2026-10-28"),
      5,
    ]);
    expect(summary?.alliance).toBeNull();
  });

  it("compares with the oldest reading when none is 7 days older", async () => {
    const { summary } = await playerProgress(db, 30);

    expect(summary?.from.at).toEqual(at("2026-10-20"));
    expect(summary?.alliance).toEqual({ unionId: 2, tag: "TRI", medianPercent: 10 });
  });
});

describe("progressSteps: the player's day by day (issue 773)", () => {
  it("reads the player's own name from daily and event rosters, with no blocked roster key", async () => {
    const progress = await playerProgress(db, 8);

    expect(progress.readings.map((r) => r.name)).toEqual(["P8", "P8", "P8", "P8"]);
    expect(findBlockedKeys(progressSteps(progress.readings))).toEqual([]);
  });

  const reading = (day: string, over: Partial<ProgressReading> = {}): ProgressReading => ({
    at: at(day),
    day,
    event: null,
    unionId: 1,
    tag: "OGs",
    name: "Nana",
    power: 100,
    kills: 5,
    rank: 1,
    ...over,
  });

  it("lists the readings newest first, each with its might and kills change", () => {
    const steps = progressSteps([
      reading("2026-11-01"),
      reading("2026-11-02", { power: 120, kills: 9 }),
    ]);

    expect(steps.map((s) => [s.reading.at, s.power, s.kills])).toEqual([
      [at("2026-11-02"), 20, 4],
      [at("2026-11-01"), null, null],
    ]);
  });

  it("shows no change when either side has no value", () => {
    const [step] = progressSteps([reading("2026-11-01", { power: null }), reading("2026-11-02")]);

    expect([step?.power, step?.kills]).toEqual([null, 0]);
  });

  it("names a rename and a move to another alliance", () => {
    const [step] = progressSteps([
      reading("2026-11-01"),
      reading("2026-11-02", { name: "Nana Prime", unionId: 2, tag: "TRI" }),
    ]);

    expect(step?.renamedFrom).toBe("Nana");
    expect(step?.movedFrom).toEqual({ unionId: 1, tag: "OGs" });
  });

  it("marks a change that spans days with no reading, and not the next day's reading", () => {
    const steps = progressSteps([
      reading("2026-11-01"),
      // The daily read's time moves by a few hours from day to day (D72): still the next day.
      reading("2026-11-02", { at: at("2026-11-02", "14:00") }),
      reading("2026-11-06"),
    ]);

    expect(steps.map((s) => s.gap)).toEqual([true, false, false]);
  });
});
