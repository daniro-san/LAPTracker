// The read status bar's clock (D135, review of PR 515): one look while mounting, then a timer to the soonest
// line still to go, and none once nothing is left to go, so an expired done line never redraws the bar
// without end.
import { describe, expect, it } from "vitest";

import type { StatusLine } from "@/lib/private/read-status";

import { batchMayRun, nextWake } from "./read-status-wake";

const done = (until: number): StatusLine => ({
  id: "squads",
  text: "Squads",
  tone: "quiet",
  until,
});
const key: StatusLine = { id: "key", text: "Key", tone: "attention", settings: true };

describe("nextWake (D135)", () => {
  it("looks once while mounting, then waits for the soonest line still to go, then sets no timer", () => {
    expect(nextWake([done(5_000)], 0)).toBe(0);
    expect(nextWake([key, done(9_000), done(5_000)], 1_000)).toBe(4_000);
    // Every `until` has passed: no timer, so nothing redraws the bar again.
    expect(nextWake([key, done(5_000)], 5_000)).toBeNull();
    expect(nextWake([key], 1_000)).toBeNull();
  });
});

describe("batchMayRun (D141)", () => {
  it("lets the poll ask only in the first 5 minutes of each 15-minute tick slot", () => {
    const at = (hhmm: string) => Date.parse(`2026-11-20T${hhmm}:00Z`);
    expect(batchMayRun(at("23:30"))).toBe(true);
    expect(batchMayRun(at("23:34"))).toBe(true);
    expect(batchMayRun(at("23:35"))).toBe(false);
    expect(batchMayRun(at("23:44"))).toBe(false);
    expect(batchMayRun(at("23:45"))).toBe(true);
  });
});
