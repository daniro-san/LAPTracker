import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "./dictionary";

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
