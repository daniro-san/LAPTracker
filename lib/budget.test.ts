import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  dailyReadQuota,
  laterWindowReads,
  MAX_RETRIES,
  requiredQuota,
  sampleQuota,
} from "./budget";

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

  it("keeps a later window's Before and After in the reserve (D160)", () => {
    expect(sampleQuota(20, 0, 2) - sampleQuota(20)).toBe(50);
  });

  it("keeps the KvK opponent's End reads in the After's reserve, and reads none of them itself (D152)", () => {
    // 2 × (20 + 15 + 5) + 1 + 4 × 20: the opponent adds 2 per End read, never 4.
    expect(sampleQuota(20, 15)).toBe(161);
    expect(sampleQuota(20, 1) - sampleQuota(20)).toBe(2);
  });
});

describe("laterWindowReads (D160)", () => {
  const at = (iso: string) => new Date(`2026-12-05T${iso}:00Z`);
  const w1 = { n: 1, beforeAt: at("02:00"), afterAt: at("02:45") };
  const w2 = { n: 2, beforeAt: at("14:15"), afterAt: at("15:15") };

  it("counts the other windows' Befores and Afters still due on the UTC day, never the run's own window", () => {
    expect(laterWindowReads([w1, w2], 1, at("02:00"))).toBe(2);
    expect(laterWindowReads([w1, w2], 2, at("14:15"))).toBe(0);
    expect(laterWindowReads([w1], 1, at("02:00"))).toBe(0);
    // A window after midnight UTC spends the next day's quota.
    const late = { n: 2, beforeAt: at("23:30"), afterAt: new Date("2026-12-06T00:30:00Z") };
    expect(laterWindowReads([w1, late], 1, at("02:00"))).toBe(1);
  });

  it("reserves a whole read of 20 alliances per later read, also before a daily read", () => {
    expect(requiredQuota(20, 2)).toBe(100);
    expect(dailyReadQuota(20, 20, 0, 4) - dailyReadQuota(20, 20)).toBe(50);
    expect(dailyReadQuota(20, 20, 0, 0)).toBe(dailyReadQuota(20, 20));
  });
});
