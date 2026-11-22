// Insights' open set (issue 678): the address fragment that reopens a set after Back, and what the
// drilldown event carries. Invented values.
import { describe, expect, it } from "vitest";

import { drilldownOf, openSetId } from "./InsightsSetMemory";

describe("Insights' open set (issue 678)", () => {
  it("reopens only its own sets, and a fragment it does not own, a stray % too, never stops the page", () => {
    expect(openSetId("#who-range-0")).toBe("who-range-0");
    for (const hash of ["#5%", "#signed-in", "#%E0%A4%A", ""])
      expect(() => openSetId(hash)).not.toThrow();
    expect(["#5%", "#signed-in", "#%E0%A4%A", ""].map(openSetId)).toEqual([null, null, null, null]);
  });

  it("sends ws_drilldown_opened with the page, the kind and a count bucket only, never the exact count", () => {
    const sent = drilldownOf("effort_range", 22);
    expect(sent).toEqual({ surface: "insights", kind: "effort_range", count_bucket: "10_plus" });
    expect(Object.values(sent)).not.toContain(22);
    expect([0, 1, 2, 4, 5, 9, 10].map((n) => drilldownOf("zone", n).count_bucket)).toEqual([
      "0",
      "1",
      "2_4",
      "2_4",
      "5_9",
      "5_9",
      "10_plus",
    ]);
  });
});
