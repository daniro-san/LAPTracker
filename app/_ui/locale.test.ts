import { describe, expect, it } from "vitest";

import { compact } from "./format";
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
    expect(pickLanguage(undefined, "hu-HU")).toEqual({ language: "en", locale: "en" });
    expect(pickLanguage("xx", null)).toEqual({ language: "en", locale: "en" });
  });

  it("formats an English fallback in English: Western digits and the Gregorian calendar (issue 671)", () => {
    for (const header of ["fa", "ar-EG", "he,ar;q=0.5"]) {
      const { language, locale } = pickLanguage(undefined, header);
      expect(language).toBe("en");
      expect(compact(1_200_000, locale)).toBe("1.20M");
      expect(
        new Intl.DateTimeFormat(locale, { timeZone: "UTC" }).format(Date.UTC(2026, 10, 22)),
      ).toBe("11/22/2026");
    }
  });

  it("keeps a served language's own formatting", () => {
    const { locale } = pickLanguage(undefined, "pt-BR,fa;q=0.5");
    expect(locale).toBe("pt-BR");
    expect(compact(4_290_000_000, locale)).toBe("4,29B");
  });
});
