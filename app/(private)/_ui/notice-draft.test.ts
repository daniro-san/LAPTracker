// The notice editor's draft bookkeeping (issue 304): what a save sends, what Translate and Improve writing
// leave behind for Accept and Undo, the conflict banner's two answers, the language tabs (issue 363), and
// "Restore this version" (D102), and "Fit to 1,000" (D113).
import { describe, expect, it } from "vitest";

import { NOTICE_FIELDS, NOTICE_LANGUAGES, planSave } from "@/lib/private/notice-rules";

import type { NoticeFields } from "./notice-client";
import {
  accept,
  askTab,
  canFit,
  changesOf,
  discard,
  draftKind,
  settle,
  startDraft,
  tabState,
  translatePlan,
  withDrafts,
  withRestored,
} from "./notice-draft";

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

/** No saved language out of date, translated or reviewed. */
const NONE = { stale: [] };

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

  it("shows each tab's state, and Accept keeps a draft's text and source while Undo puts the old text back", () => {
    const d = withDrafts(
      startDraft(saved()),
      { fr: "Postulez !" },
      { kind: "translate", from: "en", to: ["pt-BR", "fr"], text: "Apply today." },
    );
    expect(NOTICE_LANGUAGES.map((l) => tabState(d, l, { stale: ["pt-BR"] }))).toEqual([
      "written",
      "stale",
      "draft",
    ]);
    expect([draftKind(d, "fr"), draftKind(d, "en")]).toEqual(["translate", null]);
    const accepted = accept(d, "fr");
    expect([tabState(accepted, "fr", NONE), accepted.values.fr]).toEqual([
      "translated",
      "Postulez !",
    ]);
    expect(changesOf(accepted)[0]?.from).toEqual({ language: "en", version: 2 });
    const undone = discard(d, "fr");
    expect([tabState(undone, "fr", NONE), undone.from.fr]).toEqual(["empty", undefined]);
    // "Keep as is", or a change, clears "may be out of date".
    expect(tabState({ ...d, kept: { "pt-BR": true } }, "pt-BR", { stale: ["pt-BR"] })).toBe(
      "written",
    );
  });

  it("shows a saved language as reviewed, translated or written until it is changed by hand (issue 412)", () => {
    const d = startDraft(saved());
    const states = { stale: [], translated: ["en", "pt-BR"], reviewed: ["en"] } as const;
    expect(NOTICE_LANGUAGES.map((l) => tabState(d, l, states))).toEqual([
      "reviewed",
      "translated",
      "empty",
    ]);
    const typed = { ...d, values: { ...d.values, "pt-BR": "Candidate-se já." } };
    expect(tabState(typed, "pt-BR", states)).toBe("written");
  });

  it("translates from the tab in view, or fills an empty tab or a translated draft from its source", () => {
    const languages = ["pt-BR", "en", "fr"] as const;
    const d = startDraft(saved());
    expect(translatePlan(d, "en", [...languages], null)).toEqual({
      from: "en",
      to: ["pt-BR", "fr"],
    });
    expect(translatePlan(d, "fr", [...languages], "en")).toEqual({ from: "en", to: ["fr"] });
    // Without a language written in, the first written one in the officer's order.
    expect(translatePlan(d, "fr", [...languages], null)).toEqual({ from: "pt-BR", to: ["fr"] });
    const drafted = withDrafts(
      d,
      { fr: "Postulez !" },
      {
        kind: "translate",
        from: "en",
        to: ["fr"],
        text: "Apply today.",
      },
    );
    expect(translatePlan(drafted, "fr", [...languages], "pt-BR")).toEqual({
      from: "en",
      to: ["fr"],
    });
    const empty = startDraft(
      Object.fromEntries(NOTICE_FIELDS.map((f) => [f, { value: "", version: 0 }])) as NoticeFields,
    );
    expect(translatePlan(empty, "en", [...languages], null)).toBeNull();
  });

  it("restores an earlier version as drafts to check, which Translate replaces and Save still version-checks", () => {
    const d = withRestored(startDraft(saved()), {
      title: "Queen",
      en: "Apply on Monday.",
      for_members: "true",
    });
    expect(draftKind(d, "en")).toBe("restore");
    expect(tabState(d, "en", NONE)).toBe("draft");
    expect(d.values.for_members).toBe("true");
    expect(accept(d, "en").values.en).toBe("Apply on Monday.");
    expect(draftKind(accept(d, "en"), "en")).toBeNull();
    expect(discard(d, "en").values.en).toBe("Apply today.");
    // Translate into the restored language: the draft is the translation's now.
    const translated = withDrafts(
      d,
      { en: "Apply today!" },
      { kind: "translate", from: "pt-BR", to: ["en"], text: "Candidate-se hoje." },
    );
    expect(translated.restored.en).toBeUndefined();
    expect(draftKind(translated, "en")).toBe("translate");
    // Save names the versions the editor opened with: a newer save of English refuses it (409).
    const changes = changesOf(d);
    expect(changes.find((c) => c.field === "en")?.version).toBe(2);
    const newer = {
      title: { version: 1, value: "Queen", basis: null },
      en: { version: 9, value: "Apply now.", basis: 2 },
    };
    expect(planSave(newer, changes)).toEqual({ ok: false, conflicts: ["en"] });
  });

  it("offers Fit only over the limit, and its draft gets Accept and Undo", () => {
    const d = startDraft(saved());
    expect(canFit(d, "en")).toBe(false);
    // 1,000 characters is within the limit; one emoji more is over it (graphemes, not code units).
    const full = { ...d, values: { ...d.values, en: "a".repeat(1000) } };
    expect(canFit(full, "en")).toBe(false);
    const over = { ...full, values: { ...full.values, en: `${"a".repeat(1000)}🙂` } };
    expect(canFit(over, "en")).toBe(true);
    const fitted = withDrafts(over, { en: "Short." }, { kind: "fit", language: "en", text: "x" });
    expect([draftKind(fitted, "en"), tabState(fitted, "en", NONE)]).toEqual(["fit", "draft"]);
    expect(canFit(fitted, "en")).toBe(false);
    expect(discard(fitted, "en").values.en).toBe(over.values.en);
    expect(draftKind(accept(fitted, "en"), "en")).toBeNull();
    expect(askTab({ kind: "fit", language: "fr", text: "x" })).toBe("fr");
  });

  it("keeps a fitted fresh translation linked to its source; Fit on hand-written text does not", () => {
    const long = "b".repeat(1001);
    const translated = withDrafts(
      startDraft(saved()),
      { fr: long },
      { kind: "translate", from: "en", to: ["fr"], text: "Apply today." },
    );
    const fitted = withDrafts(
      translated,
      { fr: "Postulez." },
      { kind: "fit", language: "fr", text: long },
    );
    expect(draftKind(fitted, "fr")).toBe("fit");
    const fr = changesOf(fitted).find((c) => c.field === "fr");
    expect(fr?.from).toEqual({ language: "en", version: 2 });
    // The save takes English's basis: the other languages are not marked out of date.
    const state = {
      en: { version: 2, value: "Apply today.", basis: 2 },
      "pt-BR": { version: 3, value: "Candidate-se hoje.", basis: 2 },
    };
    const plan = planSave(state, changesOf(fitted));
    expect(plan.ok && plan.edits.find((e) => e.field === "fr")?.basis).toBe(2);
    // Translate from the fitted tab still refills it from English.
    expect(translatePlan(fitted, "fr", ["en", "pt-BR", "fr"], "en")).toEqual({
      from: "en",
      to: ["fr"],
    });
    const hand = { ...startDraft(saved()), values: { ...startDraft(saved()).values, en: long } };
    const own = withDrafts(hand, { en: "Apply." }, { kind: "fit", language: "en", text: long });
    expect(changesOf(own).find((c) => c.field === "en")?.from).toBeUndefined();
  });

  it("Undo after Fit on an accepted translation brings it back still linked to its source", () => {
    const long = "c".repeat(1001);
    const translated = accept(
      withDrafts(
        startDraft(saved()),
        { fr: long },
        { kind: "translate", from: "en", to: ["fr"], text: "Apply today." },
      ),
      "fr",
    );
    const fitted = withDrafts(
      translated,
      { fr: "Court." },
      { kind: "fit", language: "fr", text: long },
    );
    const undone = discard(fitted, "fr");
    expect(undone.values.fr).toBe(long);
    expect(changesOf(undone).find((c) => c.field === "fr")?.from).toEqual({
      language: "en",
      version: 2,
    });
    // An unaccepted translation: Undo goes back past it, so the link goes too.
    const fresh = withDrafts(
      startDraft(saved()),
      { fr: long },
      { kind: "translate", from: "en", to: ["fr"], text: "Apply today." },
    );
    const back = discard(
      withDrafts(fresh, { fr: "Court." }, { kind: "fit", language: "fr", text: long }),
      "fr",
    );
    expect([back.values.fr, back.from.fr]).toEqual(["", undefined]);
  });

  it("counts Fit's limit on trimmed text, as the route does", () => {
    const d = startDraft(saved());
    const padded = { ...d, values: { ...d.values, en: `${"a".repeat(1000)}\n\n   ` } };
    expect(canFit(padded, "en")).toBe(false);
  });

  it("puts a failed request's error on the tab it was asked from, whichever tab is open when it answers", () => {
    const text = "Apply today.";
    expect(askTab({ kind: "translate", from: "en", to: ["pt-BR", "fr"], text })).toBe("en");
    expect(askTab({ kind: "translate", from: "en", to: ["fr"], text })).toBe("fr");
    expect(askTab({ kind: "improve", language: "pt-BR", tone: "warmer", text })).toBe("pt-BR");
  });
});
