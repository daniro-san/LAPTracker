import { describe, expect, it } from "vitest";

import {
  clockIn,
  mondayOf,
  offsetLabel,
  parseTime,
  typedTime,
  zonedInstant,
} from "./calendar-time";
import { endOf } from "./calendar-words";

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

  it("puts the colon in as a time is typed on a digit keypad, and keeps one the officer typed", () => {
    expect(["2", "21", "210", "2100", "930", "0930"].map(typedTime)).toEqual([
      "2",
      "21",
      "21:0",
      "21:00",
      "9:30",
      "09:30",
    ]);
    expect(["21:", "21:0", "9:3", "18h00", "21:000", "21:00 ST"].map(typedTime)).toEqual([
      "21:",
      "21:0",
      "9:3",
      "18:00",
      "21:00",
      "21:00",
    ]);
    expect(parseTime(typedTime("2100"))).toBe(1260);
  });

  it("ends an Elixir window after its 30 minutes and any other entry with its server day (issue 585)", () => {
    const iso = (ms: number) => new Date(ms).toISOString();
    expect(iso(endOf("elixir", "2026-11-22", 18 * 60, SERVER, "16:15"))).toBe(
      "2026-11-22T20:30:00.000Z",
    );
    expect(iso(endOf("undead", "2026-11-21", 20 * 60, SERVER, "16:15"))).toBe(
      "2026-11-22T02:00:00.000Z",
    );
  });

  it("shows KvK Saturday's KvK and its Raid prep as Started at 15:00 ST and Ended at 17:00 ST, after the 16:15 ST End read", () => {
    const at15 = Date.parse("2026-11-21T17:00:00Z"); // Sat 15:00 ST
    const at17 = Date.parse("2026-11-21T19:00:00Z"); // Sat 17:00 ST
    // The KvK entry starts at 12:00 ST; a Raid prep added by hand has no time of its own.
    for (const [kind, minute] of [
      ["kvk", 12 * 60],
      ["shield", 12 * 60],
      ["shield", null],
    ] as const) {
      const end = endOf(kind, "2026-11-21", minute, SERVER, "16:15");
      expect(new Date(end).toISOString()).toBe("2026-11-21T18:15:00.000Z"); // Sat 16:15 ST
      expect(at15).toBeLessThan(end); // "Started"
      expect(at17).toBeGreaterThanOrEqual(end); // "Ended"
    }
  });
});
