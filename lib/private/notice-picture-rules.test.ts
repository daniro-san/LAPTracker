// The browser's resize plan for a notice's picture (D119): at most 1600 px on the long side, never enlarged;
// every quality at full size before the picture is made smaller; the plan ends at MIN_SIDE.
import { describe, expect, it } from "vitest";

import { attempts, fitWithin, MIN_SIDE, QUALITIES } from "./notice-picture-rules";

describe("notice picture resize plan", () => {
  it("brings the long side to 1600 px, keeps the proportions and never enlarges", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1170, 2532)).toEqual({ width: 739, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("steps the quality down at 1600 px first, then shrinks, and stops at the smallest size", () => {
    const plan = attempts(4000, 3000);
    expect(plan.slice(0, QUALITIES.length)).toEqual(
      QUALITIES.map((quality) => ({ width: 1600, height: 1200, quality })),
    );
    expect(plan[QUALITIES.length]).toEqual({ width: 1280, height: 960, quality: QUALITIES[0] });
    expect(plan.at(-1)).toEqual({ width: MIN_SIDE, height: 240, quality: QUALITIES.at(-1) });
    expect(attempts(200, 100)).toHaveLength(QUALITIES.length);
  });
});
