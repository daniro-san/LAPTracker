import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { allianceSnapshots, events, snapshots } from "../schema";
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
});
