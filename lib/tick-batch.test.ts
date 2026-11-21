// The clock rule every run poll shares (D141): the 5 minutes after each cron-job.org and tick.yml tick.
import { describe, expect, it } from "vitest";

import { batchMayRun } from "./tick-batch";

describe("batchMayRun (D141)", () => {
  it("lets the poll ask only in the 5 minutes after each cron-job.org and tick.yml tick", () => {
    const at = (hhmm: string) => Date.parse(`2026-11-20T${hhmm}:00Z`);
    expect(batchMayRun(at("23:30"))).toBe(true);
    expect(batchMayRun(at("23:34"))).toBe(true);
    expect(batchMayRun(at("23:35"))).toBe(false);
    expect(batchMayRun(at("23:37"))).toBe(true); // tick.yml
    expect(batchMayRun(at("23:41"))).toBe(true);
    expect(batchMayRun(at("23:42"))).toBe(false);
    expect(batchMayRun(at("23:45"))).toBe(true);
  });
});
