import { createElement, type ReactElement } from "react";
import { prerender } from "react-dom/static";
import { describe, expect, it } from "vitest";

import type { Clock } from "@/app/_ui/format";

import { QuotaFact, TickFact } from "./StatusFacts";

// Sun 22 Nov 2026, 11:20 UTC (09:20 ST).
const NOW = new Date("2026-11-22T11:20:00Z");
const clock = { stamp: (at: Date) => at.toISOString().slice(0, 16) } as Clock;

async function text(el: ReactElement): Promise<string> {
  const { prelude } = await prerender(el);
  const html = await new Response(prelude).text();
  return html
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const quota = (remaining: number, at = new Date("2026-11-22T01:31:00Z")) =>
  text(createElement(QuotaFact, { quota: { remaining, at }, now: NOW, clock }));

describe("Status's API calls fact (F34)", () => {
  it("says how many are left and that it is above the 1,000 plan, never OK, when today's reading is above 1,000", async () => {
    const above = await quota(3869);
    expect(above).toContain("3,869 left");
    expect(above).toContain("Above the 1,000 plan");
    expect(above).not.toContain("OK");
    expect(above).not.toContain("of 1,000");
    expect(await quota(1000)).toContain("1,000 of 1,000 OK");
    expect(await quota(899)).toContain("899 of 1,000 Low · under 900");
    // Yesterday's reading: what is left, with no verdict.
    const old = await quota(3869, new Date("2026-11-21T16:00:00Z"));
    expect(old).toContain("3,869 left Not read today");
    expect(old).not.toContain("Above");
  });
});

describe("Status's Last tick fact (D45, D141)", () => {
  it("says Late when no tick came since the newest heartbeat slot the watcher judges, and nothing when one did", async () => {
    const tick = (startedAt: Date) =>
      text(createElement(TickFact, { ticks: [{ startedAt, outcome: "idle" }], now: NOW, clock }));
    expect(await tick(new Date("2026-11-22T05:52:00Z"))).toContain("2026-11-22T05:52 Late");
    expect(await tick(new Date("2026-11-22T09:07:00Z"))).not.toContain("Late");
  });
});
