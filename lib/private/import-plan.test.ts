import { describe, expect, it } from "vitest";

import { fillPlan } from "./import-plan";

describe("what a sheet import fills (#297)", () => {
  it("fills only empty fields, once per member, and counts the rest as kept", () => {
    const rows = [
      { uid: 1, facts: { squadMight: 10_700_000, troopTier: 9 } },
      { uid: 1, facts: { troopTier: 8 } }, // the same member twice: the first row wins
      { uid: 2, facts: { adTech: 83 } }, // already set by an officer
      { uid: null, facts: { adTech: 50 } }, // not a member, or still open
    ];
    const plan = fillPlan(
      rows,
      (r) => r.uid,
      (uid, field) => uid === 2 && field === "adTech",
    );

    expect(plan.fill).toEqual([
      { uid: 1, field: "squadMight", value: 10_700_000 },
      { uid: 1, field: "troopTier", value: 9 },
    ]);
    expect(plan.kept).toBe(2);
  });
});
