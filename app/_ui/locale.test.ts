import { describe, expect, it } from "vitest";

import { parseZone, pickLanguage } from "./locale";

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

describe("pickLanguage", () => {
  it("takes the lang cookie, else the first Accept-Language tag in a language we write, else English", () => {
    expect(pickLanguage("ru", "es-ES,es;q=0.9")).toEqual({ language: "ru", locale: "ru" });
    expect(pickLanguage(undefined, "hu-HU,es-AR;q=0.8,ru;q=0.5")).toEqual({
      language: "es",
      locale: "es-AR",
    });
    expect(pickLanguage(undefined, "pt-PT,en;q=0.5")).toEqual({
      language: "pt-BR",
      locale: "pt-PT",
    });
    expect(pickLanguage("en", "en-GB,ru;q=0.5")).toEqual({ language: "en", locale: "en-GB" });
    expect(pickLanguage(undefined, "hu-HU")).toEqual({ language: "en", locale: "hu-HU" });
    expect(pickLanguage("xx", null)).toEqual({ language: "en", locale: "en" });
  });
});
