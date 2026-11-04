import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { requiredQuota } from "./budget";

describe("requiredQuota", () => {
  it("covers one fetch per alliance for both phases plus the reserve, for any alliance count", () => {
    fc.assert(
      fc.property(fc.nat({ max: 1000 }), (n) => {
        expect(requiredQuota(n)).toBeGreaterThanOrEqual(2 * n + 10);
        expect(requiredQuota(n + 1)).toBeGreaterThan(requiredQuota(n));
      }),
    );
  });

  it("asks for 50 calls with the 20 configured alliances", () => {
    expect(requiredQuota(20)).toBe(50);
  });
});
