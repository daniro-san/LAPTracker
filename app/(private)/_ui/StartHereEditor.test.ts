import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import {
  shAccept,
  shChanges,
  shKeep,
  shSaved,
  shTabState,
  shTranslatePlan,
  shUndo,
  startShDraft,
  withShDrafts,
} from "./start-here-draft";
import { StartHereEditor } from "./StartHereEditor";

const text = (glossary: string, rules = "") => ({ glossary, rules, ask: "" });
const LANGUAGES = ["en", "pt-BR", "fr"] as const;

describe("the Start here editor on the notices editor's parts (D116)", () => {
  it("draws the shared language tabs with each state, and Translate and Improve writing", () => {
    const html = renderToStaticMarkup(
      createElement(StartHereEditor, {
        slug: "ogs",
        ai: true,
        languages: LANGUAGES,
        first: "en",
        // EN saved after PT: PT may be out of date.
        texts: {
          en: text("Rally: a group attack."),
          "pt-BR": text("Rally: ataque."),
          fr: text(""),
        },
        versions: { en: 2, "pt-BR": 1, fr: 0 },
        max: { glossary: 4000, rules: 3000, ask: 1500 },
        t: WORKSPACE_DICTIONARIES.en,
        viewer: "en",
      }),
    );

    const tabs = html.match(/<button[^>]*role="tab"[^>]*>.*?<\/button>/g) ?? [];
    expect(tabs.map((b) => b.match(/id="([^"]+)"/)?.[1])).toEqual([
      "sh-tab-en",
      "sh-tab-pt-BR",
      "sh-tab-fr",
    ]);
    expect(tabs[0]).toContain("Written");
    expect(tabs[1]).toContain("Out of date");
    expect(tabs[2]).toContain("Missing");
    expect(html).toContain("to PT and FR");
    expect(html).toContain("Improve writing");
    expect(html).toContain("data-notice-editor");
  });

  it("Translate fills drafts; Accept keeps one, Undo brings the other back; the source saves with it", () => {
    const start = startShDraft(
      { en: text("Rally: a group attack.", "Be kind."), "pt-BR": text(""), fr: text("") },
      { en: 0, "pt-BR": 0, fr: 0 },
    );
    expect(shTranslatePlan(start, "en", LANGUAGES, "en")).toEqual({
      from: "en",
      to: ["pt-BR", "fr"],
    });

    const drafted = withShDrafts(
      start,
      {
        "pt-BR": text("Rally: ataque.", "Sejam gentis."),
        fr: text("Rally : attaque.", "Soyez gentils."),
      },
      "en",
      ["fr"],
    );
    expect(shTabState(drafted, "pt-BR")).toBe("draft");
    expect(drafted.partly).toEqual({ fr: true });

    const done = shUndo(shAccept(drafted, "pt-BR"), "fr");
    expect(shTabState(done, "pt-BR")).toBe("written");
    expect(shTabState(done, "fr")).toBe("empty");
    // EN is unsaved too here; the translation alone would still bring its source along.
    expect(shChanges(done)).toEqual(["en", "pt-BR"]);
  });

  it("Keep as is saves the language with the newest one, so neither is out of date after", () => {
    const saved = startShDraft(
      { en: text("Old glossary."), "pt-BR": text("Glossário novo."), fr: text("") },
      { en: 1, "pt-BR": 2, fr: 0 },
    );
    expect(shTabState(saved, "en")).toBe("stale");
    const kept = shKeep(saved, "en");
    expect(shTabState(kept, "en")).toBe("written");
    expect(shChanges(kept)).toEqual(["en", "pt-BR"]);
  });

  it("after Keep as is and Save, every written language is written, none out of date", () => {
    const kept = shKeep(
      startShDraft(
        { en: text("Old glossary."), "pt-BR": text("Glossário novo."), fr: text("Glossaire.") },
        { en: 1, "pt-BR": 2, fr: 2 },
      ),
      "en",
    );
    const after = shSaved(kept, shChanges(kept), 3);
    for (const l of LANGUAGES) expect(shTabState(after, l)).toBe("written");
  });
});
