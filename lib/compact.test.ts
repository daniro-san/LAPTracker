import { describe, expect, it } from "vitest";

import { compactLarge } from "./compact";

describe("compactLarge", () => {
  it("picks the unit after rounding, so no boundary reads 1000K, 1000M or 1000B", () => {
    expect(compactLarge(999_499, "en")).toBe("999K");
    expect(compactLarge(999_500, "en")).toBe("1.00M");
    expect(compactLarge(999_950, "en")).toBe("1.00M");
    expect(compactLarge(999_499_999, "en")).toBe("999M");
    expect(compactLarge(999_500_000, "en")).toBe("1.00B");
    expect(compactLarge(999_500_000_000, "en")).toBe("1.00T");
    expect(compactLarge(1_000, "en")).toBe("1.00K");
  });

  it("keeps three significant digits and the locale's decimal separator", () => {
    expect(compactLarge(4_290_000_000, "en")).toBe("4.29B");
    expect(compactLarge(4_290_000_000, "pt-BR")).toBe("4,29B");
    expect(compactLarge(271_400, "en-GB")).toBe("271K");
    expect(compactLarge(60_149_999, "en-GB")).toBe("60.1M");
  });
});
