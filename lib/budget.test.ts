import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { requiredQuota, sampleQuota } from "./budget";

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

describe("sampleQuota", () => {
  it("leaves the After its reserve after a sample's worst case, for any alliance count", () => {
    fc.assert(
      fc.property(fc.nat({ max: 1000 }), (n) => {
        // Worst case: the quota call and every read retried 3 times.
        expect(sampleQuota(n) - (1 + 4 * n)).toBeGreaterThanOrEqual(requiredQuota(n));
      }),
    );
  });

  it("asks for 131 calls with the 20 configured alliances", () => {
    expect(sampleQuota(20)).toBe(131);
  });
});
