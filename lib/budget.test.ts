import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { MAX_RETRIES, requiredQuota, sampleQuota } from "./budget";

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
        // Worst case: the quota call and every read retried to the limit.
        expect(sampleQuota(n) - (1 + (MAX_RETRIES + 1) * n)).toBeGreaterThanOrEqual(
          requiredQuota(n),
        );
      }),
    );
  });

  it("asks for 131 calls with the 20 configured alliances", () => {
    expect(sampleQuota(20)).toBe(131);
  });

  it("keeps the KvK opponent's End reads in the After's reserve, and reads none of them itself (D152)", () => {
    // 2 × (20 + 15 + 5) + 1 + 4 × 20: the opponent adds 2 per End read, never 4.
    expect(sampleQuota(20, 15)).toBe(161);
    expect(sampleQuota(20, 1) - sampleQuota(20)).toBe(2);
  });
});
