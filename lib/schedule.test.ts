import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { RUN_DEADLINE_MS } from "./compute";
import {
  endsInServerDay,
  inEventWindow,
  isKvkDay,
  nextEvent,
  nextKvk,
  serverMinuteOfDay,
  slotOf,
  targetEvent,
  type ScheduleConfig,
} from "./schedule";
import { tickClockDue } from "./tick-gate";

// Saturdays at 12:00 server time (UTC−2), so Saturday 2026-11-07 is 14:00Z.
const cfg: ScheduleConfig = {
  SERVER_TZ: "Etc/GMT+2",
  EVENT_WEEKDAY: 6,
  EVENT_TIME: "12:00",
  SNAPSHOT_BEFORE: "10:00",
  SNAPSHOT_AFTER: "14:00",
  SNAPSHOT_WINDOW_MIN: 30,
  QUOTA_CHECK_AT: "fri 20:00",
  REHEARSAL_AT: "",
  DAILY_ROSTER_AT: "04:00",
};
const day = (iso: string) => targetEvent(new Date(iso), cfg, false).name;

describe("targetEvent", () => {
  it("is the next Saturday on a Tuesday after a Saturday whose two snapshots are done", () => {
    expect(targetEvent(new Date("2026-11-10T12:00:00Z"), cfg, true).name).toBe(
      "Saturday Event 2026-11-14",
    );
  });

  it("is that Saturday on its evening while the After is missing", () => {
    expect(day("2026-11-07T20:00:00Z")).toBe("Saturday Event 2026-11-07");
  });

  it("is the past Saturday on a Tuesday when its After is missing", () => {
    expect(day("2026-11-10T12:00:00Z")).toBe("Saturday Event 2026-11-07");
  });
});

// The Friday noon before each Saturday: the event the tick makes next.
const saturday = (iso: string) => nextEvent(new Date(`${iso}T12:00:00Z`), cfg);
const iso = (d: Date) => d.toISOString();

describe("the 4-week cycle", () => {
  it("makes Origin of Chaos with two windows on 2026-12-05 and keeps the env event on 2026-11-28 and 2026-12-12", () => {
    const ooc = saturday("2026-12-04");
    expect(ooc.name).toBe("Origin of Chaos 2026-12-05");
    expect(iso(ooc.eventAtUtc)).toBe("2026-12-05T02:10:00.000Z");
    expect(ooc.windows.map((w) => [iso(w.beforeAt), iso(w.afterAt)])).toEqual([
      ["2026-12-05T02:00:00.000Z", "2026-12-05T02:45:00.000Z"],
      ["2026-12-05T14:15:00.000Z", "2026-12-05T15:15:00.000Z"],
    ]);
    expect([iso(ooc.beforeAt), iso(ooc.afterAt)]).toEqual([
      "2026-12-05T02:00:00.000Z",
      "2026-12-05T15:15:00.000Z",
    ]);
    expect(saturday("2026-11-27").name).toBe("Saturday Event 2026-11-28");
    expect(saturday("2026-12-11").name).toBe("Saturday Event 2026-12-12");
    expect(saturday("2026-12-11").windows).toHaveLength(1);
  });

  it("repeats every 4 weeks from week 1 (2026-11-14) and leaves the weeks before it alone", () => {
    const names = ["2026-11-06", "2026-12-25", "2027-01-01", "2027-01-29", "2027-12-03"].map(
      (fri) => saturday(fri).name,
    );
    expect(names).toEqual([
      "Saturday Event 2026-11-07",
      "Saturday Event 2026-12-26",
      "Origin of Chaos 2027-01-02",
      "Origin of Chaos 2027-01-30",
      "Origin of Chaos 2027-12-04",
    ]);
  });

  it("opens the tick's clock gate for the day-ahead row and each window, not in the gap (D141)", () => {
    const due = [
      "2026-12-04T02:00:00Z",
      "2026-12-05T02:00:00Z",
      "2026-12-05T08:00:00Z",
      "2026-12-05T14:15:00Z",
    ].map((t) => tickClockDue(new Date(t), cfg));
    expect(due).toEqual([true, true, false, true]);
  });

  it("pauses inside each window only, not in the gap between them", () => {
    const paused = ["02:30", "03:30", "08:00", "14:30", "15:50"].map((t) =>
      inEventWindow(new Date(`2026-12-05T${t}:00Z`), cfg),
    );
    // After 02:45 and 15:15, each After keeps its 30 min window (03:15, 15:45).
    expect(paused).toEqual([true, false, false, true, false]);
  });

  it("tells a KvK day from an Origin of Chaos day, and the next KvK passes over Origin of Chaos (#806)", () => {
    expect(["2026-11-28", "2026-12-05", "2026-12-12"].map(isKvkDay)).toEqual([true, false, true]);
    // Friday before Origin of Chaos, and Sunday after the KvK before it.
    expect(nextKvk(new Date("2026-12-04T12:00:00Z"), cfg).name).toBe("Saturday Event 2026-12-12");
    expect(nextKvk(new Date("2026-11-29T12:00:00Z"), cfg).name).toBe("Saturday Event 2026-12-12");
    expect(nextKvk(new Date("2026-11-27T12:00:00Z"), cfg).name).toBe("Saturday Event 2026-11-28");
  });
});

describe("serverMinuteOfDay", () => {
  it("is the minutes since midnight on the server clock: 14:15Z is 12:15 server time, and 01:30Z the evening before", () => {
    expect(serverMinuteOfDay(new Date("2026-11-21T14:15:00Z"), cfg)).toBe(12 * 60 + 15);
    expect(serverMinuteOfDay(new Date("2026-11-21T01:30:00Z"), cfg)).toBe(23 * 60 + 30);
  });
});

describe("slotOf", () => {
  const cadences = Array.from({ length: 60 }, (_, i) => i + 1).filter((n) => 60 % n === 0);

  it("is a grid instant at most the time and less than one cadence before it, for any cadence that divides 60", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Date.UTC(2020, 0, 1), max: Date.UTC(2040, 0, 1) }),
        fc.constantFrom(...cadences),
        (ms, n) => {
          const at = new Date(ms);
          const slot = slotOf(at, n);
          expect(slot.getUTCMinutes() % n).toBe(0);
          expect(slot.getUTCSeconds()).toBe(0);
          expect(slot.getUTCMilliseconds()).toBe(0);
          expect(slot.getTime()).toBeLessThanOrEqual(ms);
          expect(slot.getTime()).toBeGreaterThan(ms - n * 60_000);
        },
      ),
    );
  });
});

describe("endsInServerDay", () => {
  it("is true for a 100 s run that starts at 23:58:20 server time and false one second later", () => {
    // 23:58:20 server (UTC−2) is 01:58:20 UTC; 100 s later is exactly 00:00:00 server.
    expect(endsInServerDay(new Date("2026-11-08T01:58:20Z"), RUN_DEADLINE_MS, cfg)).toBe(true);
    expect(endsInServerDay(new Date("2026-11-08T01:58:21Z"), RUN_DEADLINE_MS, cfg)).toBe(false);
  });
});
