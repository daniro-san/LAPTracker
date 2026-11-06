import { describe, expect, it } from "vitest";

import { homeEvent } from "./events";

type Run = `${"before" | "after"}:${"running" | "complete" | "partial" | "failed"}`;
const event = (id: number, manual: boolean, ...runs: Run[]) => ({
  id,
  manual,
  snapshots: runs.map((run) => {
    const [phase, status] = run.split(":") as ["before" | "after", "complete"];
    return { phase, status };
  }),
});

describe("homeEvent", () => {
  it("picks the newest event with a complete Before, a real one before a manual round", () => {
    // listEvents order: newest first.
    const pick = (...events: ReturnType<typeof event>[]) => homeEvent(events)?.id;
    const done = ["before:complete", "after:complete"] as const;
    // The tick's upcoming Saturday has no snapshot yet: last week's Saturday keeps the home page.
    expect(pick(event(3, false), event(2, false, ...done))).toBe(2);
    // Only the upcoming Saturday is real: the manual round with data takes it (production, 2026-11-06).
    expect(pick(event(3, false), event(2, true, ...done))).toBe(2);
    // A newer manual round does not take the home page from a real event that has data.
    expect(pick(event(3, true, ...done), event(2, false, "before:complete"))).toBe(2);
    // A running Before or an After alone is not data.
    expect(pick(event(3, false, "before:running"), event(2, false, ...done))).toBe(2);
    expect(pick(event(3, false, "after:complete"), event(2, false, ...done))).toBe(2);
    // Nothing has data: the newest real event.
    expect(
      pick(event(4, true, "before:failed"), event(3, false, "after:complete"), event(2, false)),
    ).toBe(3);
  });
});
