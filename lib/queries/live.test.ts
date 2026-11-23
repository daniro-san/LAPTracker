import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import { eventProgress } from "./live";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

const at = (hhmm: string) => new Date(`2026-11-21T${hhmm}:00Z`);
const EVERY = { everyMin: 15 };

/** One event 12:00-16:00 with a Start, a sample per [time, kills of alliance 1, isFresh], optionally an End. */
async function seedEvent(samples: [string, number, boolean?][], end: boolean) {
  const [ev] = await db
    .insert(events)
    .values({
      name: "Saturday Event 2026-11-21",
      eventAtUtc: at("14:00"),
      allianceIds: [1],
      beforeAt: at("12:00"),
      afterAt: at("16:00"),
    })
    .returning({ id: events.id });
  const eventId = (ev as { id: number }).id;
  const reading = async (
    phase: "before" | "sample" | "after",
    time: string,
    kills: number,
    fresh = true,
  ) => {
    const [snap] = await db
      .insert(snapshots)
      .values({
        eventId,
        phase,
        slotAt: phase === "sample" ? at(time) : null,
        startedAt: at(time),
        status: "complete",
      })
      .returning({ id: snapshots.id });
    await db.insert(allianceSnapshots).values({
      snapshotId: (snap as { id: number }).id,
      unionId: 1,
      totalPower: 1000,
      totalKills: kills,
      source: "v1",
      isFresh: fresh,
    });
  };
  await reading("before", "12:00", 100);
  for (const [time, kills, fresh] of samples) await reading("sample", time, kills, fresh);
  if (end) await reading("after", "16:00", 900);
  return eventId;
}

describe("eventProgress", () => {
  it("is live between the Start and the End, with the latest and next reading and the change since Start", async () => {
    const id = await seedEvent(
      [
        ["12:15", 130],
        ["12:30", 160],
      ],
      false,
    );
    const p = await eventProgress(db, id, { now: at("12:40"), ...EVERY });
    expect(p?.live).toBe(true);
    expect(p?.readings).toBe(2);
    expect(p?.latestAt).toEqual(at("12:30"));
    expect(p?.next?.at).toEqual(at("12:45"));
    expect(p?.standings[0]?.change).toEqual({ power: 0, kills: 60 });
    expect(p?.pulse.map((s) => s.kills)).toEqual([30, 30]);
  });

  it("is not live once the End has run, and keeps the readings", async () => {
    const id = await seedEvent([["12:15", 130]], true);
    const p = await eventProgress(db, id, { now: at("16:30"), ...EVERY });
    expect(p?.live).toBe(false);
    expect(p?.next).toBeNull();
    expect(p?.readings).toBe(1);
  });

  it("is live from the Start with no sample yet: the strip's data, nothing else", async () => {
    const id = await seedEvent([], false);
    const p = await eventProgress(db, id, { now: at("12:10"), ...EVERY });
    expect(p).toMatchObject({ live: true, readings: 0, latestAt: null, startAt: at("12:00") });
    expect(p?.next?.at).toEqual(at("12:15"));
    expect([p?.standings, p?.pulse]).toEqual([[], []]);
  });

  it("names no busiest span before 4 intervals are compared", async () => {
    const three = await seedEvent(
      [
        ["12:15", 130],
        ["12:30", 160],
        ["12:45", 200],
      ],
      false,
    );
    expect((await eventProgress(db, three, { now: at("12:50"), ...EVERY }))?.busiest).toBeNull();
  });

  it("is null without samples", async () => {
    const id = await seedEvent([], true);
    expect(await eventProgress(db, id, { now: at("16:30"), ...EVERY })).toBeNull();
  });

  it("gives an alliance whose latest reading is stale the change at its latest usable sample", async () => {
    const id = await seedEvent(
      [
        ["12:15", 130],
        ["12:30", 160, false],
      ],
      false,
    );
    const p = await eventProgress(db, id, { now: at("12:40"), ...EVERY });
    expect(p?.standings[0]).toMatchObject({ change: { power: 0, kills: 30 }, at: at("12:15") });
  });

  it("counts the kills of the members in both readings: a joiner's lifetime kills and a one-row dropout move nothing", async () => {
    const eventId = await seedEvent([], false);
    const [start] = await db.select({ id: allianceSnapshots.id }).from(allianceSnapshots);
    await db.insert(memberSnapshots).values([
      { allianceSnapshotId: (start as { id: number }).id, uid: 11, name: "m11", kills: 100 },
      { allianceSnapshotId: (start as { id: number }).id, uid: 12, name: "m12", kills: 200 },
    ]);
    // Member 13 joins at 12:15 with 5,000 lifetime kills; member 12 is missing from the 12:30 row only.
    const readings: [string, [number, number][]][] = [
      [
        "12:15",
        [
          [11, 110],
          [12, 220],
          [13, 5000],
        ],
      ],
      [
        "12:30",
        [
          [11, 130],
          [13, 5010],
        ],
      ],
      [
        "12:45",
        [
          [11, 150],
          [12, 260],
          [13, 5030],
        ],
      ],
    ];
    for (const [time, members] of readings) {
      const [snap] = await db
        .insert(snapshots)
        .values({
          eventId,
          phase: "sample",
          slotAt: at(time),
          startedAt: at(time),
          status: "complete",
        })
        .returning({ id: snapshots.id });
      await db.insert(allianceSnapshots).values({
        snapshotId: (snap as { id: number }).id,
        unionId: 1,
        totalPower: 1000,
        totalKills: members.reduce((t, [, k]) => t + k, 0),
        source: "v1",
        isFresh: true,
        memberUids: members.map(([uid]) => uid),
        memberNames: members.map(([uid]) => `m${uid}`),
        memberPower: members.map(() => 10),
        memberKills: members.map(([, k]) => k),
      });
    }
    const p = await eventProgress(db, eventId, { now: at("12:50"), ...EVERY });
    expect(p?.pulse.map((s) => s.kills)).toEqual([30, 30, 40]);
    // 50 + 60 by the two who stayed, 30 by the joiner since his first reading.
    expect(p?.standings[0]?.change).toEqual({ power: 0, kills: 140 });
  });

  it("splits each interval by alliance (D158 rule 7 (b)): the parts add up to its kills, and an alliance not read fresh in both readings is left out", async () => {
    const eventId = await seedEvent([], true);
    const [start] = await db.select({ id: allianceSnapshots.snapshotId }).from(allianceSnapshots);
    const startId = (start as { id: number }).id;
    // Alliances 2 and 3 at the Start (alliance 1 is the seed's); 3 is stale at 12:30.
    await db.insert(allianceSnapshots).values(
      [2, 3].map((unionId) => ({
        snapshotId: startId,
        unionId,
        totalPower: 1000,
        totalKills: 1000 * unionId,
        source: "v1" as const,
        isFresh: true,
      })),
    );
    const readings: [string, number, number, number, boolean][] = [
      // time, kills of alliances 1, 2 and 3, whether 3 is fresh
      ["12:15", 130, 2050, 3010, true],
      ["12:30", 190, 2070, 3500, false],
      ["12:45", 200, 2170, 3600, true],
    ];
    for (const [time, k1, k2, k3, fresh3] of readings) {
      const [snap] = await db
        .insert(snapshots)
        .values({
          eventId,
          phase: "sample",
          slotAt: at(time),
          startedAt: at(time),
          status: "complete",
        })
        .returning({ id: snapshots.id });
      await db.insert(allianceSnapshots).values(
        (
          [
            [1, k1, true],
            [2, k2, true],
            [3, k3, fresh3],
          ] as const
        ).map(([unionId, totalKills, isFresh]) => ({
          snapshotId: (snap as { id: number }).id,
          unionId,
          totalPower: 1000,
          totalKills,
          source: "v1" as const,
          isFresh,
        })),
      );
    }
    const p = await eventProgress(db, eventId, { now: at("17:00"), ...EVERY });
    const parts = p?.pulse.map((s) => s.parts.map((x) => [x.unionId, x.kills])) ?? [];
    expect(parts).toEqual([
      [
        [1, 30],
        [2, 50],
        [3, 10],
      ],
      // 3 is stale at 12:30: left out of both intervals that read it.
      [
        [1, 60],
        [2, 20],
      ],
      [
        [1, 10],
        [2, 100],
      ],
    ]);
    for (const s of p?.pulse ?? []) {
      expect(s.parts.reduce((a, x) => a + x.kills, 0)).toBe(s.kills);
      expect(s.parts).toHaveLength(s.alliances);
    }
    // What the split names as left out: the Start's alliances not among the parts.
    const read = p?.standings.map((s) => s.unionId) ?? [];
    expect(
      p?.pulse.map((s) => read.filter((id) => !s.parts.some((x) => x.unionId === id))),
    ).toEqual([[], [3], [3]]);
  });
});
