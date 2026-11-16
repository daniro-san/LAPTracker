import { describe, expect, it } from "vitest";

import type { Measured } from "./compute";
import { busiestSpan, nextReading, serverPulse, standings, type Slice } from "./live";

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
  it("gives each alliance's change since Start at the latest reading, none for a stale one, most kills first", () => {
    const start = slice("12:00", { 1: m(100), 2: m(100), 3: m(100) });
    const out = standings(start, [
      slice("12:15", { 1: m(110), 2: m(150), 3: m(120) }),
      slice("12:30", { 1: m(130, 900), 2: m(200, 1000, false), 3: m(125) }),
    ]);
    expect(out.map((s) => [s.unionId, s.change])).toEqual([
      [1, { power: -100, kills: 30 }],
      [3, { power: 0, kills: 25 }],
      [2, null],
    ]);
    expect(out[0]?.at).toEqual(at("12:30"));
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

  it("names the two consecutive intervals with most kills and their share of all kills", () => {
    expect(busiestSpan(pulse)).toMatchObject({
      from: at("12:15"),
      to: at("12:45"),
      kills: 60,
      share: 60 / 75,
      index: 1,
    });
  });

  it("names none before there are two compared intervals with a gain", () => {
    expect(busiestSpan(pulse.slice(0, 1))).toBeNull();
    expect(busiestSpan(pulse.slice(3))).toBeNull();
  });
});

describe("nextReading", () => {
  const after = at("18:00");

  it("inside a slot, waits for the next slot and looks a minute later", () => {
    const next = nextReading(at("12:40"), 15, after);
    expect(next?.at).toEqual(at("12:45"));
    expect(next?.refreshAt).toEqual(new Date(at("12:45").getTime() + MIN));
  });

  it("at a slot boundary, still waits for that slot's own sample", () => {
    expect(nextReading(at("12:30"), 15, after)?.at).toEqual(at("12:30"));
    expect(nextReading(new Date(at("12:30").getTime() + 61_000), 15, after)?.at).toEqual(
      at("12:45"),
    );
  });

  it("waits for the End instead of a slot that holds no sample, and stops after the End", () => {
    const end = nextReading(at("17:50"), 15, after);
    expect(end?.at).toEqual(after);
    expect(end?.refreshAt).toEqual(at("18:02"));
    expect(nextReading(at("18:02"), 15, after)).toBeNull();
    expect(nextReading(at("12:00"), 0, after)).toBeNull();
  });
});
