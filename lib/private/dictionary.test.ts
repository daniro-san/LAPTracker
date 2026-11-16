import { describe, expect, it } from "vitest";

import { pickWorkspaceLanguage, WORKSPACE_DICTIONARIES } from "./dictionary";

describe("the workspace dictionary (D71, #305)", () => {
  it("has the same keys in en, pt-BR and fr, and no empty value", () => {
    const keys = Object.keys(WORKSPACE_DICTIONARIES.en).sort();
    for (const [language, words] of Object.entries(WORKSPACE_DICTIONARIES)) {
      expect(Object.keys(words).sort(), language).toEqual(keys);
      const empty = Object.entries(words).filter(([, v]) => v.trim() === "");
      expect(empty, language).toEqual([]);
    }
  });
});

describe("pickWorkspaceLanguage", () => {
  it("takes the switch's cookie over the browser's languages", () => {
    expect(pickWorkspaceLanguage("fr", "pt-BR,pt;q=0.9")).toBe("fr");
  });

  it("reads Portuguese from the browser as pt-BR", () => {
    expect(pickWorkspaceLanguage(undefined, "pt-BR,pt;q=0.9")).toBe("pt-BR");
  });

  it("reads a regional French as French", () => {
    expect(pickWorkspaceLanguage(undefined, "fr-CA")).toBe("fr");
  });

  it("falls back to English for a language the workspace is not written in", () => {
    expect(pickWorkspaceLanguage(undefined, "de-DE,ja;q=0.5")).toBe("en");
  });

  it("ignores a cookie that is not one of the three languages", () => {
    expect(pickWorkspaceLanguage("es", "fr")).toBe("fr");
  });

  it("finds nothing for object-prototype names in the header", () => {
    expect(pickWorkspaceLanguage(undefined, "__proto__,constructor")).toBe("en");
  });
});
