import { describe, expect, it } from "vitest";

import { targetEvent, type ScheduleConfig } from "./schedule";

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
