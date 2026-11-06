import { describe, expect, it } from "vitest";

import type { RoundView } from "./actions";
import { roundPlan } from "./ManualSection";

const round = (...phases: [phase: "before" | "after", status: string][]): RoundView => ({
  id: 7,
  name: "Manual Round Nov-5",
  visibility: "standalone",
  postPublic: false,
  calls: 21 * phases.length,
  phases: phases.map(([phase, status]) => ({ phase, status, text: "", at: "Nov 5, 20:01" })),
});

describe("roundPlan (issue 157, D55)", () => {
  it.each([
    [
      "with no round, starting one is the primary action",
      null,
      { complete: false, again: { before: false, after: false }, create: "primary" },
    ],
    [
      "after the Before, only the Before is Record again and the After seal stays the next step",
      round(["before", "complete"]),
      { complete: false, again: { before: true, after: false }, create: "secondary" },
    ],
    [
      "with both phases done, the round is complete and closed: nothing to record again, and starting a round is primary",
      round(["before", "complete"], ["after", "complete"]),
      { complete: true, again: { before: false, after: false }, create: "primary" },
    ],
    [
      "a running phase keeps its seal",
      round(["before", "running"]),
      { complete: false, again: { before: false, after: false }, create: "secondary" },
    ],
    [
      "a partly done phase keeps its seal, so the round is not complete",
      round(["before", "complete"], ["after", "partial"]),
      { complete: false, again: { before: true, after: false }, create: "secondary" },
    ],
  ] as const)("%s", (_, manual, plan) => {
    expect(roundPlan(manual)).toEqual(plan);
  });
});
