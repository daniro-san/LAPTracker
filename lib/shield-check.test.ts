// The Raid Shield check's rules (D137): when each read runs on the server clock (UTC−2 here), and what a
// reading says: a shield seen or not, never its length.
import { describe, expect, it } from "vitest";

import { TEST_ENV } from "./app-context.test-helpers";
import {
  DEFAULT_TIMES,
  morningMinuteOf,
  passWindows,
  resetWindow,
  shieldPassAt,
  shieldWindowOpen,
  suggestionOf,
  timeChoices,
  timesOf,
} from "./shield-check";

const at = (iso: string) => new Date(iso);
const pass = (iso: string, morning = 600, night = 1410) =>
  shieldPassAt(at(iso), TEST_ENV, { night, morning })?.pass ?? null;

describe("the Raid Shield check's rules (D137)", () => {
  it("keeps 23:30, 02:30 and 10:00 ST and their windows while an alliance saved no times (issue 859)", () => {
    expect(timesOf(null)).toEqual({ night: 1410, morning: 600, reset: 150 });
    expect(passWindows("2026-11-20", TEST_ENV, DEFAULT_TIMES)).toEqual({
      night: { from: at("2026-11-21T01:00:00Z"), to: at("2026-11-21T02:00:00Z") }, // Fri 23:00–00:00 ST
      morning: { from: at("2026-11-21T12:00:00Z"), to: at("2026-11-21T14:00:00Z") }, // Sat 10:00–12:00 ST
    });
    expect(resetWindow("2026-11-20", TEST_ENV)).toEqual({
      from: at("2026-11-21T04:30:00Z"), // Sat 02:30 ST
      to: at("2026-11-21T05:15:00Z"),
    });
  });

  it("offers no after-reset time whose window meets an event's window (D160, issue 859)", () => {
    // The next four weeks from 2026-11-28 hold Origin of Chaos on 2026-12-05 (00:10–01:30 ST).
    const { reset } = timeChoices(TEST_ENV, at("2026-11-28T12:00:00Z"));
    expect(reset).not.toContain(30); // 00:30 ST
    expect(reset).toContain(90); // 01:30 ST
    expect(reset).toContain(150); // 02:30 ST
  });

  it("moves the night read and its window to the alliance's later time (issue 859)", () => {
    expect(pass("2026-11-21T01:30:00Z", 600, 1425)).toBeNull(); // Fri 23:30 ST: not yet
    expect(pass("2026-11-21T01:45:00Z", 600, 1425)).toBe("night"); // 23:45 ST
    expect(passWindows("2026-11-20", TEST_ENV, { night: 1425, morning: 600 }).night.from).toEqual(
      at("2026-11-21T01:15:00Z"), // 23:15 ST
    );
  });

  it("runs Friday from 23:30 ST until the reset, and Saturday from the morning time until 12:00 ST", () => {
    expect(pass("2026-11-21T01:29:00Z")).toBeNull(); // Fri 23:29 ST
    expect(shieldPassAt(at("2026-11-21T01:30:00Z"), TEST_ENV, DEFAULT_TIMES)).toEqual({
      pass: "night",
      day: "2026-11-20",
      endsAt: at("2026-11-21T02:00:00Z"),
    });
    expect(pass("2026-11-21T11:59:00Z")).toBeNull(); // Sat 09:59 ST
    expect(pass("2026-11-21T12:00:00Z")).toBe("morning");
    expect(pass("2026-11-21T12:20:00Z", 645)).toBeNull(); // before the alliance's 10:45
    expect(pass("2026-11-21T13:59:00Z")).toBe("morning");
    expect(pass("2026-11-21T14:00:00Z")).toBeNull(); // 12:00 ST: KvK
    expect(pass("2026-11-20T01:40:00Z")).toBeNull(); // Thursday night
    // The tick reads no workspace outside the windows.
    expect(shieldWindowOpen(at("2026-11-21T11:59:00Z"), TEST_ENV)).toBe(false);
    expect(shieldWindowOpen(at("2026-11-21T01:30:00Z"), TEST_ENV)).toBe(true);
    expect(morningMinuteOf(720)).toBe(660);
    expect(morningMinuteOf(null)).toBe(600);
  });

  it("says only that a shield was seen, whatever its shield_type (0 was seen for 8 h and 24 h)", () => {
    const seen = {
      shielding: 1,
      shieldType: 0,
      mapAt: at("2026-11-21T00:32:00Z"),
      readAt: at("2026-11-21T01:31:00Z"),
    };
    expect(suggestionOf(seen)).toBe("on");
    expect(suggestionOf({ ...seen, shieldType: 2 })).toBe("on");
    expect(suggestionOf({ ...seen, shielding: 0 })).toBe("not_seen");
    expect(suggestionOf({ ...seen, shielding: null })).toBe("unknown");
  });
});
