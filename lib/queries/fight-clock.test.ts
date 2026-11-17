import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { allianceSnapshots, events, snapshots } from "../schema";
import { eventPulses, getFightClock, sampledEventIds, type PulseOptions } from "./fight-clock";
import { progressRows } from "./live";

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(() => truncateAll(db));

const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00Z`);
// The test server is UTC-2 (Etc/GMT+2): 14:00Z is noon on the server clock.
const OPTIONS: PulseOptions = {
  everyMin: 15,
  serverTz: "Etc/GMT+2",
  rowsOf: (id) => progressRows(db, id),
};

interface Sample {
  time: string;
  kills: number;
  fresh?: boolean;
  failed?: boolean;
}

/** One event on `day` 12:00Z–16:00Z with a Start (100 kills), these samples of alliance 1, and no End unless asked. */
async function seedEvent(
  day: string,
  samples: Sample[],
  { end = true, manual = false, visibility = "standalone" as "standalone" | "admin" } = {},
) {
  const [ev] = await db
    .insert(events)
    .values({
      name: `Saturday Event ${day}`,
      eventAtUtc: at(day, "14:00"),
      allianceIds: [1],
      beforeAt: at(day, "12:00"),
      afterAt: at(day, "16:00"),
      manual,
      visibility,
    })
    .returning({ id: events.id });
  const eventId = (ev as { id: number }).id;
  const reading = async (
    phase: "before" | "sample" | "after",
    time: string,
    kills: number,
    { fresh = true, failed = false } = {},
  ) => {
    const [snap] = await db
      .insert(snapshots)
      .values({
        eventId,
        phase,
        slotAt: phase === "sample" ? at(day, time) : null,
        startedAt: at(day, time),
        status: "complete",
      })
      .returning({ id: snapshots.id });
    await db.insert(allianceSnapshots).values({
      snapshotId: (snap as { id: number }).id,
      unionId: 1,
      totalPower: 1000,
      totalKills: failed ? null : kills,
      source: "v1",
      isFresh: fresh,
      error: failed ? "v1 503" : null,
    });
  };
  await reading("before", "12:00", 100);
  for (const s of samples) await reading("sample", s.time, s.kills, s);
  if (end) await reading("after", "16:00", 900);
  return eventId;
}

/** Samples 12:15..13:30 gaining 10, 10, 20, 40, 10 kills: the busiest 30 minutes are 13:00-13:30. */
const FIVE: Sample[] = [
  { time: "12:15", kills: 110 },
  { time: "12:30", kills: 120 },
  { time: "12:45", kills: 140 },
  { time: "13:00", kills: 180 },
  { time: "13:15", kills: 190 },
];

describe("sampledEventIds", () => {
  it("is an event with a fresh, error-free sample, and neither an event with only a Start and an End nor one whose samples are stale or failed", async () => {
    const sampled = await seedEvent("2026-11-21", FIVE);
    await seedEvent("2026-11-14", []); // only a Start and an End
    await seedEvent("2026-11-07", [
      { time: "12:15", kills: 110, fresh: false },
      { time: "12:30", kills: 0, failed: true },
    ]);
    expect(await sampledEventIds(db)).toEqual(new Set([sampled]));
  });

  it("leaves out an event that is not public", async () => {
    await seedEvent("2026-11-21", FIVE, { visibility: "admin" });
    expect(await sampledEventIds(db)).toEqual(new Set());
  });
});

describe("eventPulses", () => {
  it("lists an unsampled event as unsampled with no slots, and does not read its rows", async () => {
    const id = await seedEvent("2026-11-14", []);
    const rowsOf = vi.fn(OPTIONS.rowsOf);
    expect(await eventPulses(db, [{ id, done: true }], { ...OPTIONS, rowsOf })).toEqual([
      { id, sampled: false, clock: null },
    ]);
    expect(rowsOf).not.toHaveBeenCalled();
  });

  it("gives a sampled event its slots on the server clock, each with its share, and the busiest 30 minutes", async () => {
    const id = await seedEvent("2026-11-21", FIVE);
    const [pulse] = await eventPulses(db, [{ id, done: true }], OPTIONS);
    const clock = pulse?.clock;
    // 12:00Z is 10:00 on the server clock: 600 minutes. The interval 12:00-12:15 is the 600 slot.
    expect(clock?.slots.map((s) => [s.minute, s.kills, s.state])).toEqual([
      [600, 10, "moved"],
      [615, 10, "moved"],
      [630, 20, "moved"],
      [645, 40, "moved"],
      [660, 10, "moved"],
    ]);
    const shares = clock?.slots.map((s) => s.share ?? Number.NaN) ?? [];
    [10, 10, 20, 40, 10].forEach((kills, i) => expect(shares[i]).toBeCloseTo(kills / 90, 10));
    expect(clock?.slots[0]?.at).toEqual(at("2026-11-21", "12:00"));
  });

  it("names the busiest rolling 30 minutes only once 4 slots are compared", async () => {
    const id = await seedEvent("2026-11-21", FIVE);
    const [pulse] = await eventPulses(db, [{ id, done: true }], OPTIONS);
    expect(pulse?.clock?.busiest).toMatchObject({ index: 2, kills: 60 });
    expect(pulse?.clock?.busiest?.from).toEqual(at("2026-11-21", "12:30"));
    expect(pulse?.clock?.busiest?.to).toEqual(at("2026-11-21", "13:00"));

    const short = await seedEvent("2026-11-14", FIVE.slice(0, 3));
    const [few] = await eventPulses(db, [{ id: short, done: true }], OPTIONS);
    expect(few?.clock?.busiest).toBeNull();
  });

  it("marks a slot with no update from the game as still, and a slot with no reading as missing", async () => {
    const id = await seedEvent("2026-11-21", [
      { time: "12:15", kills: 110 },
      { time: "12:30", kills: 110 }, // nothing changed: the game sent no update
      { time: "13:15", kills: 150 }, // 12:45 and 13:00 were not read
    ]);
    const [pulse] = await eventPulses(db, [{ id, done: true }], OPTIONS);
    expect(pulse?.clock?.slots.map((s) => [s.minute, s.state])).toEqual([
      [600, "moved"],
      [615, "still"],
      [630, "missing"],
      [645, "missing"],
      [660, "missing"],
    ]);
  });

  it("reads a finished event's rows under the done key and a running one's under the live key", async () => {
    const done = await seedEvent("2026-11-14", FIVE);
    const live = await seedEvent("2026-11-21", FIVE, { end: false });
    const rowsOf = vi.fn(OPTIONS.rowsOf);
    await eventPulses(
      db,
      [
        { id: done, done: true },
        { id: live, done: false },
      ],
      { ...OPTIONS, rowsOf },
    );
    expect(rowsOf.mock.calls).toEqual([
      [done, true],
      [live, false],
    ]);
  });
});

describe("getFightClock", () => {
  const NOW = at("2026-11-22", "10:00");

  it("lists scheduled public events newest first, the ones before the first sampled event off with the date it starts", async () => {
    const old = await seedEvent("2026-11-07", []);
    const sampled = await seedEvent("2026-11-21", FIVE);
    const { events: rows } = await getFightClock(db, NOW, OPTIONS);
    expect(rows.map((e) => [e.id, e.pulse.sampled])).toEqual([
      [sampled, true],
      [old, false],
    ]);
    expect(rows[1]?.off).toEqual({ kind: "since", at: at("2026-11-21", "14:00") });
  });

  it("says the next event when no event is sampled, and that the readings are to come for one still ahead", async () => {
    const past = await seedEvent("2026-11-14", []);
    const ahead = await seedEvent("2026-11-28", [], { end: false });
    const { events: rows } = await getFightClock(db, NOW, OPTIONS);
    expect(rows.find((e) => e.id === past)?.off).toEqual({ kind: "next" });
    expect(rows.find((e) => e.id === ahead)?.off).toEqual({ kind: "waiting" });
  });

  it("leaves out a manual round", async () => {
    await seedEvent("2026-11-21", FIVE, { manual: true });
    expect((await getFightClock(db, NOW, OPTIONS)).events).toEqual([]);
  });
});
