// The e2e global setup waits out the server's day change instead of failing a required check (D150).
import { describe, expect, it } from "vitest";

import { waitForDayChange } from "./global-setup";

const at = (iso: string) => Date.parse(iso);

describe("waitForDayChange", () => {
  it("lets a run start right away away from 02:00 UTC (00:00 ST)", () => {
    expect(waitForDayChange(at("2026-11-22T01:49:00Z"))).toBe(0);
    expect(waitForDayChange(at("2026-11-22T02:10:00Z"))).toBe(0);
  });

  it("makes a run that starts at 01:58 UTC wait until 02:10 UTC, so it never fails on the clock", () => {
    expect(waitForDayChange(at("2026-11-22T01:58:20Z"))).toBe(
      at("2026-11-22T02:10:00Z") - at("2026-11-22T01:58:20Z"),
    );
    expect(waitForDayChange(at("2026-11-22T02:05:00Z"))).toBe(5 * 60_000);
  });
});
