// The Secret Ops review's "Saved n thefts." line takes the language's own plural rule: 0 is singular in
// French and Portuguese, plural in English.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import { SavedThefts } from "./SecretOpsReview";

const line = (language: "en" | "fr", n: number) =>
  renderToStaticMarkup(
    createElement(SavedThefts, {
      saved: { saved: n, left: { help: 0, own: 0, duplicate: 0 } },
      slug: "invented",
      w: Object.fromEntries(
        Object.entries(WORKSPACE_DICTIONARIES[language]).filter(([k]) => k.startsWith("shots.")),
      ),
      language,
      thefts: false,
    }),
  );

describe("the Secret Ops review's saved line", () => {
  it("says 0 thefts in the singular in French and the plural in English", () => {
    expect(line("fr", 0)).toContain("0 vol enregistré.");
    expect(line("en", 0)).toContain("Saved 0 thefts.");
    expect(line("fr", 2)).toContain("2 vols enregistrés.");
  });
});
