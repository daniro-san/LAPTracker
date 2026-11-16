import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { slotOf, targetEvent, type ScheduleConfig } from "./schedule";

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
