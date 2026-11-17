import { describe, expect, it } from "vitest";

import { clockIn, mondayOf, offsetLabel, parseTime, zonedInstant } from "./calendar-time";

const SERVER = "Etc/GMT+2"; // UTC−2, the server's clock

describe("server time and the viewer's own time (issue 300)", () => {
  it("turns a server day and time into the instant, and that instant into a viewer's clock", () => {
    // Monday 2026-11-16, 16:00 ST is 18:00 UTC.
    const at = zonedInstant("2026-11-16", 16 * 60, SERVER);
    expect(new Date(at).toISOString()).toBe("2026-11-16T18:00:00.000Z");
    expect(clockIn(at, SERVER, "2026-11-16")).toEqual({ time: "16:00", shift: 0 });
    // A viewer in UTC−3 (São Paulo) and one in UTC+2 (Johannesburg).
    expect(clockIn(at, "America/Sao_Paulo", "2026-11-16")).toEqual({ time: "15:00", shift: 0 });
    expect(clockIn(at, "Africa/Johannesburg", "2026-11-16")).toEqual({ time: "20:00", shift: 0 });
    // 23:00 ST is already the next day in UTC+2, and 00:30 ST is still the day before in UTC−3.
    const late = zonedInstant("2026-11-16", 23 * 60, SERVER);
    expect(clockIn(late, "Africa/Johannesburg", "2026-11-16")).toEqual({ time: "03:00", shift: 1 });
    expect(clockIn(late, "America/Sao_Paulo", "2026-11-16")).toEqual({ time: "22:00", shift: 0 });
    const early = zonedInstant("2026-11-20", 30, SERVER);
    expect(clockIn(early, "America/Sao_Paulo", "2026-11-20")).toEqual({ time: "23:30", shift: -1 });
    expect(offsetLabel(SERVER, at)).toBe("UTC−2");
  });

  it("reads the times officers type, and weeks start on Monday", () => {
    expect(["18:00", "1800", "18", "18.00", "18h00", " 9:05 "].map(parseTime)).toEqual([
      1080, 1080, 1080, 1080, 1080, 545,
    ]);
    expect(["24:00", "18:60", "6pm", ""].map(parseTime)).toEqual([null, null, null, null]);
    expect([mondayOf("2026-11-16"), mondayOf("2026-11-22"), mondayOf("2026-11-23")]).toEqual([
      "2026-11-16",
      "2026-11-16",
      "2026-11-23",
    ]);
  });
});
