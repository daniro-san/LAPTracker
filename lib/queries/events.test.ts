import { describe, expect, it } from "vitest";

import { homeEvent } from "./events";

type Status = "running" | "complete" | "partial" | "failed";
const event = (id: number, manual: boolean, ...statuses: Status[]) => ({
  id,
  manual,
  snapshots: statuses.map((status) => ({ status })),
});

describe("homeEvent", () => {
  it("picks the newest event with data, a real one before a manual round", () => {
    // listEvents order: newest first.
    const pick = (...events: ReturnType<typeof event>[]) => homeEvent(events)?.id;
    // The tick's upcoming Saturday has no snapshot yet: last week's Saturday keeps the home page.
    expect(pick(event(3, false), event(2, false, "complete", "complete"))).toBe(2);
    // Only the upcoming Saturday is real: the manual round with data takes it (production, 2026-11-06).
    expect(pick(event(3, false), event(2, true, "complete", "complete"))).toBe(2);
    // A newer manual round does not take the home page from a real event that has data.
    expect(pick(event(3, true, "complete"), event(2, false, "complete"))).toBe(2);
    // Nothing has data (a running or failed run is none): the newest real event.
    expect(pick(event(4, true, "failed"), event(3, false, "running"), event(2, false))).toBe(3);
  });
});
