// The notice editor's draft bookkeeping (issue 304): what a save sends, what Translate and Improve writing
// leave behind for Undo, and the conflict banner's two answers.
import { describe, expect, it } from "vitest";

import { NOTICE_FIELDS } from "@/lib/private/notice-rules";

import type { NoticeFields } from "./notice-client";
import { changesOf, settle, startDraft, withDrafts } from "./notice-draft";

/** A saved notice: title v1, English v2, Portuguese v3 (translated), French never written. */
const saved = (): NoticeFields => {
  const fields = Object.fromEntries(NOTICE_FIELDS.map((f) => [f, { value: "", version: 0 }]));
  return {
    ...(fields as NoticeFields),
    title: { value: "Queen", version: 1 },
    en: { value: "Apply today.", version: 2 },
    "pt-BR": { value: "Candidate-se hoje.", version: 3 },
  };
};

describe("the notice draft", () => {
  it("sends the changed and kept fields with their versions, and a translation's source while it is unchanged", () => {
    let d = startDraft(saved());
    expect(changesOf(d)).toEqual([]);
    d = withDrafts(
      d,
      { fr: "Postulez aujourd’hui." },
      { kind: "translate", from: "en", to: ["fr"], text: "Apply today." },
    );
    d = { ...d, kept: { "pt-BR": true } };
    expect(changesOf(d)).toEqual([
      { field: "pt-BR", value: "Candidate-se hoje.", version: 3 },
      {
        field: "fr",
        value: "Postulez aujourd’hui.",
        version: 0,
        from: { language: "en", version: 2 },
      },
    ]);
    // English edited after the translation: the French is saved as hand-written, without a source.
    d = { ...d, values: { ...d.values, en: "Apply today, then pass it on." } };
    expect(changesOf(d).find((c) => c.field === "fr")).toEqual({
      field: "fr",
      value: "Postulez aujourd’hui.",
      version: 0,
    });
  });

  it("keeps each language's text before a draft for Undo, and makes the translated-from language a source", () => {
    const start = startDraft(saved());
    const translated = withDrafts(
      { ...start, from: { en: { language: "pt-BR", text: "x" } } },
      { "pt-BR": "Candidate-se hoje!", fr: "Postulez !" },
      { kind: "translate", from: "en", to: ["pt-BR", "fr"], text: "Apply today." },
    );
    expect(translated.undo).toEqual({ "pt-BR": "Candidate-se hoje.", fr: "" });
    expect(translated.from).toEqual({
      "pt-BR": { language: "en", text: "Apply today." },
      fr: { language: "en", text: "Apply today." },
    });
    // A second draft keeps the first Undo text; a rewrite is no translation.
    const improved = withDrafts(
      translated,
      { "pt-BR": "Candidatem-se!" },
      { kind: "improve", language: "pt-BR", tone: "warmer", text: "Candidate-se hoje!" },
    );
    expect(improved.undo["pt-BR"]).toBe("Candidate-se hoje.");
    expect(improved.from["pt-BR"]).toBeUndefined();
  });

  it("settles a conflict: keep mine takes only their version, use theirs takes their text", () => {
    const d = withDrafts(
      startDraft(saved()),
      { "pt-BR": "Meu rascunho" },
      { kind: "improve", language: "pt-BR", tone: "kinder", text: "x" },
    );
    const theirs = {
      field: "pt-BR" as const,
      value: "Texto da Ana",
      version: 9,
      by: "Ana",
      at: "",
    };
    const mine = settle(d, theirs, "mine");
    expect([mine.values["pt-BR"], mine.versions["pt-BR"]]).toEqual(["Meu rascunho", 9]);
    expect(changesOf(mine)).toEqual([{ field: "pt-BR", value: "Meu rascunho", version: 9 }]);
    const used = settle(d, theirs, "theirs");
    expect([used.values["pt-BR"], used.versions["pt-BR"], used.undo["pt-BR"]]).toEqual([
      "Texto da Ana",
      9,
      undefined,
    ]);
    expect(changesOf(used)).toEqual([]);
  });
});
