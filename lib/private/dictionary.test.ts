import { describe, expect, it } from "vitest";

import { fill } from "../copy";
import { dateWords } from "../date-words";
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

  it("writes every time as ST and spells server time out only in a line that names ST (issue 585 batch 4)", () => {
    const FULL = {
      en: /server time/iu,
      "pt-BR": /horário do servidor/iu,
      fr: /heure du serveur/iu,
    };
    for (const [language, words] of Object.entries(WORKSPACE_DICTIONARIES)) {
      const full = FULL[language as keyof typeof FULL];
      const values = Object.values(words);
      expect(
        values.some((v) => full.test(v)),
        language,
      ).toBe(true);
      const bare = values.filter((v) => full.test(v) && !/\bST\b/u.test(v));
      expect(bare, language).toEqual([]);
    }
    // One full term per language: never "hora do servidor" or "heure serveur".
    const stray = (language: "pt-BR" | "fr", term: RegExp) =>
      Object.values(WORKSPACE_DICTIONARIES[language]).filter((v) => term.test(v));
    expect(stray("pt-BR", /\bhora do servidor/iu)).toEqual([]);
    expect(stray("fr", /heure serveur/iu)).toEqual([]);
  });

  it("ends every Portuguese and French sentence that ends with a date without a doubled dot (issue 585 batch 4)", () => {
    const day = "2026-11-20";
    let checked = 0;
    for (const language of ["pt-BR", "fr"] as const) {
      const words = dateWords(language, "Etc/GMT+2");
      for (const text of Object.values(WORKSPACE_DICTIONARIES[language])) {
        if (!/\{(date|day)\}\.(\s|$)/u.test(text)) continue;
        checked++;
        // The short form ends in "." ("nov."): that is why their callers pass the sentence form.
        expect(fill(text, { date: words.day(day), day: words.day(day) })).toContain("..");
        const sentence = words.sentence(day);
        expect(fill(text, { date: sentence, day: sentence })).not.toContain("..");
      }
    }
    expect(checked).toBeGreaterThan(0);
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
