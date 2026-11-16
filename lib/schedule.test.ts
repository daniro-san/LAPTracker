import { describe, expect, it } from "vitest";

import { RUN_DEADLINE_MS } from "./compute";
import { endsInServerDay, targetEvent, type ScheduleConfig } from "./schedule";

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

describe("endsInServerDay", () => {
  it("is true for a 100 s run that starts at 23:58:20 server time and false one second later", () => {
    // 23:58:20 server (UTC−2) is 01:58:20 UTC; 100 s later is exactly 00:00:00 server.
    expect(endsInServerDay(new Date("2026-11-08T01:58:20Z"), RUN_DEADLINE_MS, cfg)).toBe(true);
    expect(endsInServerDay(new Date("2026-11-08T01:58:21Z"), RUN_DEADLINE_MS, cfg)).toBe(false);
  });
});
