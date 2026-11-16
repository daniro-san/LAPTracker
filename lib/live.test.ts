import { describe, expect, it } from "vitest";

import type { Measured } from "./compute";
import { busiestSpan, nextReading, overdueSlot, serverPulse, standings, type Slice } from "./live";

const MIN = 60_000;
const at = (hhmm: string) => new Date(`2026-11-21T${hhmm}:00Z`);
const m = (kills: number, power = 1000, isFresh = true): Measured => ({
  isFresh,
  totalPower: power,
  totalKills: kills,
});
const slice = (hhmm: string, alliances: Record<number, Measured>): Slice => ({
  at: at(hhmm),
  alliances: new Map(Object.entries(alliances).map(([id, v]) => [Number(id), v])),
});

describe("standings", () => {
  it("gives each alliance's change since Start at its latest usable sample, and that sample's time", () => {
    const start = slice("12:00", { 1: m(100), 2: m(100), 3: m(100) });
    const out = standings(start, [
      slice("12:15", { 1: m(110), 2: m(150), 3: m(120) }),
      slice("12:30", { 1: m(130, 900), 2: m(200, 1000, false), 3: m(125) }),
    ]);
    // Alliance 2 is stale at 12:30: its figures are from 12:15, the others' from 12:30.
    expect(out.map((s) => [s.unionId, s.change, s.at])).toEqual([
      [2, { power: 0, kills: 50 }, at("12:15")],
      [1, { power: -100, kills: 30 }, at("12:30")],
      [3, { power: 0, kills: 25 }, at("12:30")],
    ]);
  });

  it("gives no change to an alliance with no usable sample, and keeps the newest sample's time", () => {
    const out = standings(slice("12:00", { 1: m(100) }), [
      slice("12:15", { 1: m(120, 1000, false) }),
    ]);
    expect(out[0]).toMatchObject({ change: null, at: at("12:15") });
  });

  it("gives no change to an alliance missing from the latest reading", () => {
    const out = standings(slice("12:00", { 1: m(100), 2: m(100) }), [
      slice("12:15", { 1: m(120) }),
    ]);
    expect(out.find((s) => s.unionId === 2)?.change).toBeNull();
  });
});

describe("serverPulse and busiestSpan", () => {
  const readings = [
    slice("12:00", { 1: m(0), 2: m(0) }),
    slice("12:15", { 1: m(10), 2: m(5) }),
    slice("12:30", { 1: m(10), 2: m(5) }), // the game sent nothing
    slice("12:45", { 1: m(40), 2: m(35) }),
    slice("13:15", { 1: m(50), 2: m(40) }), // 13:00 was not read
  ];
  const pulse = serverPulse(readings, 15 * MIN);

  it("sums the kills each interval, tells no update from no reading, and counts the alliances compared", () => {
    expect(pulse.map((s) => [s.state, s.kills, s.alliances])).toEqual([
      ["moved", 15, 2],
      ["still", 0, 2],
      ["moved", 60, 2],
      ["missing", null, 0],
      ["missing", null, 0],
    ]);
  });

  it("leaves out an alliance that is stale in either reading", () => {
    const stale = serverPulse(
      [slice("12:00", { 1: m(0), 2: m(0) }), slice("12:15", { 1: m(10), 2: m(5, 1000, false) })],
      15 * MIN,
    );
    expect(stale[0]).toMatchObject({ kills: 10, alliances: 1 });
  });

  it("covers an off-grid Start and a missing first sample with slots from the Start to the next sample", () => {
    const gap = serverPulse(
      [slice("12:01", { 1: m(0) }), slice("12:30", { 1: m(10) })], // 12:15 was not read
      15 * MIN,
    );
    expect(gap.map((s) => [s.state, s.from, s.to])).toEqual([
      ["missing", at("12:01"), at("12:16")],
      ["missing", at("12:16"), at("12:30")],
    ]);
  });

  it("names the two consecutive intervals with most kills and their share of all kills", () => {
    expect(busiestSpan(pulse, 75)).toMatchObject({
      from: at("12:15"),
      to: at("12:45"),
      kills: 60,
      share: 60 / 75,
      index: 1,
    });
  });

  it("divides by all the kills gained since Start, so a missed reading does not inflate the share", () => {
    // 13:00 was not read: the intervals hold 75 of the 90 kills gained (50 + 40 at 13:15, from 0 at Start).
    expect(busiestSpan(pulse, 90)?.share).toBe(60 / 90);
  });

  it("names none before there are two compared intervals with a gain", () => {
    expect(busiestSpan(pulse.slice(0, 1), 75)).toBeNull();
    expect(busiestSpan(pulse.slice(3), 75)).toBeNull();
  });
});

describe("nextReading", () => {
  const after = at("18:00");

  it("inside a slot, waits for the next slot and looks a minute later", () => {
    const next = nextReading(at("12:40"), 15, after, at("12:30"));
    expect(next?.at).toEqual(at("12:45"));
    expect(next?.refreshAt).toEqual(new Date(at("12:45").getTime() + MIN));
  });

  it("at a slot boundary, still waits for that slot's own sample", () => {
    expect(nextReading(at("12:30"), 15, after, at("12:15"))?.at).toEqual(at("12:30"));
    expect(
      nextReading(new Date(at("12:30").getTime() + 61_000), 15, after, at("12:30"))?.at,
    ).toEqual(at("12:45"));
  });

  it("moves to the next slot as soon as the current slot's sample is stored", () => {
    const next = nextReading(new Date(at("12:30").getTime() + 50_000), 15, after, at("12:30"));
    expect(next?.at).toEqual(at("12:45"));
    expect(next?.refreshAt).toEqual(new Date(at("12:45").getTime() + MIN));
  });

  it("keeps waiting for a slot whose sample is missing until 3 minutes, then moves to the next slot", () => {
    const slot = at("12:30").getTime();
    const late = nextReading(new Date(slot + 61_000), 15, after, at("12:15"));
    expect(late?.at).toEqual(at("12:30"));
    expect(late?.refreshAt).toEqual(new Date(slot + 3 * MIN));
    // The refresh lands just after the 3 minutes: the slot is overdue, the page looks at the next one.
    const now = new Date(slot + 3 * MIN + 1000);
    expect(nextReading(now, 15, after, at("12:15"))?.at).toEqual(at("12:45"));
    expect(overdueSlot(now, 15, at("12:15"), after)).toEqual(at("12:30"));
  });

  it("waits for the End instead of a slot that holds no sample, and stops after the End", () => {
    const end = nextReading(at("17:50"), 15, after, at("17:30"));
    expect(end?.at).toEqual(after);
    expect(end?.refreshAt).toEqual(at("18:02"));
    expect(nextReading(at("18:02"), 15, after, at("17:45"))).toBeNull();
    expect(nextReading(at("12:00"), 0, after, at("12:00"))).toBeNull();
  });
});

describe("overdueSlot", () => {
  const after = at("18:00");

  it("names the current slot only after it is more than 3 minutes old and has no sample", () => {
    const slot = at("12:30").getTime();
    expect(overdueSlot(new Date(slot + 3 * MIN), 15, at("12:15"), after)).toBeNull();
    expect(overdueSlot(new Date(slot + 3 * MIN + 1), 15, at("12:15"), after)).toEqual(at("12:30"));
    expect(overdueSlot(new Date(slot + 4 * MIN), 15, at("12:30"), after)).toBeNull();
    expect(overdueSlot(new Date(slot + 4 * MIN), 0, at("12:15"), after)).toBeNull();
  });
});
