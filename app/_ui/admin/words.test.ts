import { describe, expect, it } from "vitest";

import { makeClock } from "../format";
import { runWord } from "./words";

const clock = makeClock("en", "UTC");

describe("runWord (D69)", () => {
  it("names a sample run by its slot's time", () => {
    expect(runWord({ phase: "sample", slotAt: new Date("2026-11-07T10:15:00Z") }, clock)).toBe(
      "Sample 10:15",
    );
  });

  it("names a Before and an After by their phase words", () => {
    expect(runWord({ phase: "before", slotAt: null }, clock)).toBe("Before snapshot");
    expect(runWord({ phase: "after", slotAt: null }, clock)).toBe("After snapshot");
  });
});
