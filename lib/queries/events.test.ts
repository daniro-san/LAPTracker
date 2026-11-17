import { describe, expect, it } from "vitest";

import { homeEvent } from "./events";

type Status = "running" | "complete" | "partial" | "failed";
const END_AT = new Date("2026-11-07T16:00:00Z");
const NOW = new Date("2026-11-09T12:00:00Z");
/** An event with a Start and, from the second status on, an End; both started at END_AT. */
const event = (id: number, manual: boolean, ...statuses: Status[]) => ({
  id,
  manual,
  afterAt: END_AT,
  snapshots: statuses.map((status, i) => ({
    phase: i === 0 ? ("before" as const) : ("after" as const),
    status,
    startedAt: END_AT,
  })),
});
// listEvents order: newest first.
// SNAPSHOT_WINDOW_MIN = 45: with one tick (15 min) after it, a missing End may still come for 60 minutes.
const pick = (events: ReturnType<typeof event>[], now = NOW) => homeEvent(events, now, 45)?.id;
const after = (minutes: number) => new Date(END_AT.getTime() + minutes * 60_000);

describe("homeEvent", () => {
  it("picks the newest event with data, a real one before a manual round", () => {
    // The tick's upcoming Saturday has no snapshot yet: last week's Saturday keeps the home page.
    expect(pick([event(3, false), event(2, false, "complete", "complete")])).toBe(2);
    // Only the upcoming Saturday is real: the manual round with data takes it (production, 2026-11-06).
    expect(pick([event(3, false), event(2, true, "complete", "complete")])).toBe(2);
    // A newer manual round does not take the home page from a real event that has data.
    expect(
      pick([event(3, true, "complete", "complete"), event(2, false, "complete", "complete")]),
    ).toBe(2);
    // Nothing has data (a running or failed run is none): the newest real event.
    expect(pick([event(4, true, "failed"), event(3, false, "running"), event(2, false)])).toBe(3);
  });

  it("falls back to the last finished result when the newest event's End never came", () => {
    const finished = event(1, false, "complete", "partial");
    // The End was left running past RUN_STALE_AFTER_MS, failed, or never ran: event 1 has the result.
    expect(pick([event(2, false, "complete", "running"), finished])).toBe(1);
    expect(pick([event(2, false, "complete", "failed"), finished])).toBe(1);
    expect(pick([event(2, false, "complete"), finished])).toBe(1);
    // While the End may still come (its run is young, or it is not due yet), the newest event stays.
    expect(pick([event(2, false, "complete", "running"), finished], after(1))).toBe(2);
    expect(pick([event(2, false, "complete"), finished], new Date("2026-11-07T14:00:00Z"))).toBe(2);
    // No End row yet, 30 min after it was due: a late tick may still start it (past 150 s, inside the
    // window); one hour after, it never came.
    expect(pick([event(2, false, "complete"), finished], after(30))).toBe(2);
    expect(pick([event(2, false, "complete"), finished], after(59))).toBe(2);
    expect(pick([event(2, false, "complete"), finished], after(60))).toBe(1);
    // No finished event at all: the newest one with data still shows.
    expect(pick([event(2, false, "complete", "failed")])).toBe(2);
  });
});
