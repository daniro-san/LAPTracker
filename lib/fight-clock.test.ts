import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { bothCover, clockColumns, eventClock, offReason, WAITING_MS } from "./fight-clock";
import type { PulseSlot, PulseState } from "./live";

const MIN = 60_000;
const EVERY = 15;
const at = (hhmm: string) => new Date(`2026-11-21T${hhmm}:00Z`);
const minuteOf = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
const LAST = at("15:45").getTime();

/** Consecutive 15-minute intervals ending at 15:45, as `serverPulse` returns them. */
function pulseOf(cells: { state: PulseState; kills: number }[]): PulseSlot[] {
  return cells.map((c, i) => {
    const to = LAST - (cells.length - 1 - i) * EVERY * MIN;
    return {
      from: new Date(to - EVERY * MIN),
      to: new Date(to),
      kills: c.state === "missing" ? null : c.state === "still" ? 0 : c.kills,
      alliances: c.state === "missing" ? 0 : 3,
      state: c.state,
      parts: [],
    };
  });
}

const moved = (...kills: number[]) => kills.map((k) => ({ state: "moved" as const, kills: k }));

const cell = fc.record({
  state: fc.constantFrom<PulseState>("moved", "moved", "still", "missing"),
  kills: fc.integer({ min: -50, max: 1_000_000 }),
});

describe("eventClock", () => {
  it("puts one slot on the grid per interval, the last on the last reading's slot, each a cadence after the one before", () => {
    const clock = eventClock(
      pulseOf([...moved(10), { state: "still", kills: 0 }, ...moved(30)]),
      EVERY,
      minuteOf,
    );
    expect(clock.slots.map((s) => [s.at, s.minute])).toEqual([
      [at("15:00"), 900],
      [at("15:15"), 915],
      [at("15:30"), 930],
    ]);
  });

  it("gives a still slot and a missing slot no share, and counts a loss of kills as no gain", () => {
    const clock = eventClock(
      pulseOf([
        ...moved(40),
        { state: "still", kills: 0 },
        { state: "missing", kills: 0 },
        ...moved(-5),
      ]),
      EVERY,
      minuteOf,
    );
    expect(clock.slots.map((s) => s.share)).toEqual([1, null, null, 0]);
  });

  it("holds an event's shares to a sum of 1 when it gained kills, and its busiest span inside it, for any readings", () => {
    fc.assert(
      fc.property(fc.array(cell, { minLength: 1, maxLength: 40 }), (cells) => {
        const clock = eventClock(pulseOf(cells), EVERY, minuteOf);
        const sum = clock.slots.reduce((t, s) => t + (s.share ?? 0), 0);
        if (clock.kills > 0) expect(sum).toBeCloseTo(1, 9);
        else expect(sum).toBe(0);
        for (const s of clock.slots)
          expect(s.share === null || (s.share >= 0 && s.share <= 1)).toBe(true);
        expect(clock.slots).toHaveLength(cells.length);
        if (clock.busiest) {
          expect(clock.busiest.share).toBeLessThanOrEqual(1);
          expect(clock.busiest.to.getTime() - clock.busiest.from.getTime()).toBe(2 * EVERY * MIN);
        }
      }),
    );
  });

  it("names the busiest rolling 30 minutes by the best two slots in a row, not by a single slot", () => {
    // 10 | 30 | 10 | 30 | 10: a single slot's best is 30, the best pair is 40 and the first of them wins.
    const clock = eventClock(pulseOf(moved(10, 30, 10, 30, 10)), EVERY, minuteOf);
    expect(clock.busiest).toMatchObject({ index: 0, kills: 40 });
    expect(clock.busiest?.from).toEqual(at("14:30"));
    expect(clock.busiest?.to).toEqual(at("15:00"));
  });

  it("is empty when there is no interval or the cadence is off", () => {
    expect(eventClock([], EVERY, minuteOf).slots).toEqual([]);
    expect(eventClock(pulseOf(moved(5)), 0, minuteOf).slots).toEqual([]);
  });
});

describe("clockColumns and bothCover", () => {
  // 4 slots from 14:45 and 6 slots from 14:15, on the same server clock.
  const short = eventClock(pulseOf(moved(5, 5, 5, 5)), EVERY, minuteOf);
  const long = eventClock(pulseOf(moved(5, 5, 5, 5, 5, 5)), EVERY, minuteOf);

  it("lines events up on the server clock: the columns are every minute either covers, in order", () => {
    expect(clockColumns([short, long]).map((c) => c.minute)).toEqual([
      855, 870, 885, 900, 915, 930,
    ]);
  });

  it("names the minutes both events cover", () => {
    expect(bothCover(short, long)).toEqual([885, 900, 915, 930]);
  });

  it("covers nothing in common with an event that has no slots", () => {
    expect(bothCover(short, eventClock([], EVERY, minuteOf))).toEqual([]);
  });
});

describe("offReason", () => {
  const first = at("14:00");
  const now = new Date(first.getTime() + 3 * 86_400_000);

  it("says the readings start with the first sampled event, for an older event", () => {
    const old = new Date(first.getTime() - 7 * 86_400_000);
    expect(offReason({ eventAtUtc: old, ended: true }, first, now)).toEqual({
      kind: "since",
      at: first,
    });
  });

  it("says the next event when none is sampled yet", () => {
    expect(offReason({ eventAtUtc: first, ended: true }, null, now)).toEqual({ kind: "next" });
  });

  it("says the readings are still to come for an event that has not ended, within a day of its time", () => {
    const soon = new Date(now.getTime() + 2 * 86_400_000);
    expect(offReason({ eventAtUtc: soon, ended: false }, first, now)).toEqual({ kind: "waiting" });
    const stuck = new Date(now.getTime() - WAITING_MS - MIN);
    expect(offReason({ eventAtUtc: stuck, ended: false }, first, now)).toEqual({ kind: "missed" });
  });
});
