import { describe, expect, it } from "vitest";

import { needsYou, quotaState, tickLate, type NeedsInput } from "./needs-you";

// Sun 22 Nov 2026, 11:20 UTC (09:20 ST): the 09:00 UTC heartbeat slot is the newest the watcher judges.
const NOW = new Date("2026-11-22T11:20:00Z");
const at = (iso: string) => new Date(iso);

/** Nothing waits: the scheduler ticked in the newest slot, no request, no error, everything set up. */
const quiet: NeedsInput = {
  now: NOW,
  tick: { last: at("2026-11-22T09:07:00Z"), lastText: "Sun, 22/11/2026, 07:07 server time" },
  dailyRetry: false,
  requests: 0,
  errors24h: 0,
  // A page error and a used-up limit: App errors' row, and 00:00 UTC, deal with those.
  workspaces: [{ attention: ["errors", "cap"] }, { attention: [] }],
  deletions: 0,
  morningQuota: { remaining: 912, at: at("2026-11-22T01:31:00Z") },
  todos: 0,
};

describe("Needs you (issue 585, F11)", () => {
  it("lists what waits on the owner in the order he acts on it, each with its count and where it is done", () => {
    const rows = needsYou({
      ...quiet,
      tick: { last: at("2026-11-22T05:52:00Z"), lastText: "Sun, 22/11/2026, 03:52 server time" },
      dailyRetry: true,
      requests: 1,
      errors24h: 3,
      workspaces: [
        { attention: ["setup"] },
        { attention: ["key", "errors", "setup"] },
        { attention: ["errors"] },
        { attention: ["cap"] },
      ],
      deletions: 1,
      morningQuota: { remaining: 640, at: at("2026-11-22T01:31:00Z") },
      todos: 4,
    });
    expect(rows.map((r) => [r.label, r.state, r.href])).toEqual([
      ["Scheduler", "Late: last tick Sun, 22/11/2026, 03:52 server time", "#status"],
      ["Daily read", "Did not finish: Retry", "#run"],
      ["Access requests", "1 waiting", "#new-alliances"],
      ["App errors", "3 in the last 24 h", "/admin/errors"],
      ["Workspaces", "2 to set up · 1 with a key to fix", "#alliances"],
      ["Workspace deletions", "1 asked", "#workspaces"],
      ["API calls", "Low: 640 left this morning", "#status"],
      ["Your to-dos", "4 open", "/admin/changes#todo"],
    ]);
    // Everything but the standing to-dos is in yarn.
    expect(rows.filter((r) => !r.attention).map((r) => r.label)).toEqual(["Your to-dos"]);
  });

  it("lists only what waits, and nothing when nothing does", () => {
    expect(needsYou(quiet)).toEqual([]);
    const workspaces = [{ attention: ["setup"] }, { attention: ["setup", "cap"] }];
    const some = needsYou({ ...quiet, requests: 1, workspaces, todos: 3 });
    expect(some.map((r) => `${r.label}: ${r.state}`)).toEqual([
      "Access requests: 1 waiting",
      "Workspaces: 2 to set up",
      "Your to-dos: 3 open",
    ]);
  });

  it("calls the API calls low only from today's reading taken before the day's spend", () => {
    const low = (morningQuota: NeedsInput["morningQuota"]) =>
      needsYou({ ...quiet, morningQuota }).map((r) => r.state);
    expect(low({ remaining: 899, at: at("2026-11-22T01:31:00Z") })).toEqual([
      "Low: 899 left this morning",
    ]);
    expect(low({ remaining: 900, at: at("2026-11-22T01:31:00Z") })).toEqual([]);
    // Yesterday's reading: the quota reset at 00:00 UTC, so it says nothing about today.
    expect(low({ remaining: 120, at: at("2026-11-21T23:40:00Z") })).toEqual([]);
    // Above the site's 1,000 is no alarm.
    expect(low({ remaining: 3869, at: at("2026-11-22T01:31:00Z") })).toEqual([]);
    expect(low(null)).toEqual([]);
  });
});

describe("quotaState (F34)", () => {
  it("reads today's reading as ok up to 1,000, above it over 1,000, low under 900, and gives an earlier UTC day no verdict", () => {
    const today = (remaining: number | null) =>
      quotaState({ remaining, at: at("2026-11-22T10:00:00Z") }, NOW);
    expect(today(1000)).toBe("ok");
    expect(today(900)).toBe("ok");
    expect(today(1001)).toBe("above");
    expect(today(899)).toBe("low");
    expect(today(null)).toBe("unknown");
    expect(quotaState(null, NOW)).toBe("unknown");
    expect(quotaState({ remaining: 3869, at: at("2026-11-21T16:00:00Z") }, NOW)).toBe("old");
  });
});

describe("tickLate (D45, D141)", () => {
  it("calls the scheduler late by the watcher's rule: no tick since the newest heartbeat slot at least 10 minutes old", () => {
    const tick = at("2026-11-22T03:05:00Z");
    expect(tickLate(tick, at("2026-11-22T05:00:00Z"))).toBe(false);
    // 06:05: the 06:00 slot is not judged until 06:10, so 03:05 still counts.
    expect(tickLate(tick, at("2026-11-22T06:05:00Z"))).toBe(false);
    expect(tickLate(tick, at("2026-11-22T06:11:00Z"))).toBe(true);
    expect(tickLate(null, NOW)).toBe(true);
  });
});
