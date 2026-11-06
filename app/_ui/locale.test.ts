import { describe, expect, it } from "vitest";

import { parseZone } from "./locale";

describe("parseZone", () => {
  it("accepts a real IANA zone and falls back to server time (null) for anything else", () => {
    expect(parseZone("Europe/Moscow")).toBe("Europe/Moscow");
    expect(parseZone("America/Los_Angeles")).toBe("America/Los_Angeles");
    expect(parseZone(undefined)).toBeNull();
    expect(parseZone("")).toBeNull();
    expect(parseZone("Not/AZone")).toBeNull();
    expect(parseZone(`Europe/${"x".repeat(80)}`)).toBeNull();
  });
});
