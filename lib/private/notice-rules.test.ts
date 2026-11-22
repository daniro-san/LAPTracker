// The notices' counter and "may be out of date" marker (issues 304, 305), and the tabs' "Translated" and
// "Reviewed" (issue 412): pure, played as a sequence of saves.
import { describe, expect, it } from "vitest";

import {
  noticeLength,
  planSave,
  reviewedLanguages,
  staleLanguages,
  type Change,
  type NoticeState,
} from "./notice-rules";

/** Applies a save the way the database does: each edit gets the next id as its version. */
function saved(state: NoticeState, changes: Change[]): NoticeState {
  const plan = planSave(state, changes);
  if (!plan.ok) throw new Error(`conflict on ${plan.conflicts.join(", ")}`);
  let id = Math.max(0, ...Object.values(state).map((f) => f.version));
  const next = { ...state };
  for (const e of plan.edits) next[e.field] = { version: ++id, ...e };
  return next;
}
const v = (state: NoticeState, field: keyof NoticeState) => state[field]?.version ?? 0;

describe("the counter (issue 304)", () => {
  it("counts what a reader sees: an emoji with its skin tone is one character", () => {
    expect(noticeLength("👑 Queen")).toBe(7);
    expect(noticeLength("été")).toBe(3);
    expect(noticeLength("👍🏽")).toBe(1);
  });
});

describe("may be out of date (issue 305)", () => {
  it("marks the other languages when one changes, until translated again or kept", () => {
    let s = saved({}, [
      { field: "title", value: "Queen", version: 0 },
      { field: "en", value: "Apply today.", version: 0 },
      {
        field: "pt-BR",
        value: "Candidate-se hoje.",
        version: 0,
        from: { language: "en", version: 0 },
      },
      {
        field: "fr",
        value: "Postulez aujourd’hui.",
        version: 0,
        from: { language: "en", version: 0 },
      },
    ]);
    expect(staleLanguages(s)).toEqual([]);
    s = saved(s, [{ field: "en", value: "Apply today, then pass it on.", version: v(s, "en") }]);
    expect(staleLanguages(s)).toEqual(["pt-BR", "fr"]);
    // Translated again from the current English: up to date.
    s = saved(s, [
      {
        field: "pt-BR",
        value: "Candidate-se e passe adiante.",
        version: v(s, "pt-BR"),
        from: { language: "en", version: v(s, "en") },
      },
    ]);
    expect(staleLanguages(s)).toEqual(["fr"]);
    // Kept as is (saved unchanged by hand): up to date, and English is not put behind.
    s = saved(s, [{ field: "fr", value: "Postulez aujourd’hui.", version: v(s, "fr") }]);
    expect(staleLanguages(s)).toEqual([]);
    // A hand change to up-to-date Portuguese puts the other two behind.
    s = saved(s, [
      { field: "pt-BR", value: "Candidate-se hoje e passe adiante.", version: v(s, "pt-BR") },
    ]);
    expect(staleLanguages(s)).toEqual(["en", "fr"]);
  });

  it("marks a translation of an older text at once, and never an empty language", () => {
    let s = saved({}, [{ field: "en", value: "Apply today.", version: 0 }]);
    const seen = v(s, "en");
    s = saved(s, [{ field: "en", value: "Apply today, then pass it on.", version: seen }]);
    s = saved(s, [
      {
        field: "fr",
        value: "Postulez aujourd’hui.",
        version: 0,
        from: { language: "en", version: seen },
      },
    ]);
    expect(staleLanguages(s)).toEqual(["fr"]);
  });

  it("refuses the whole save when a field changed since the officer's version", () => {
    const s = saved({}, [
      { field: "title", value: "Queen", version: 0 },
      { field: "en", value: "Apply today.", version: 0 },
    ]);
    const plan = planSave(s, [
      { field: "title", value: "New title", version: v(s, "title") },
      { field: "en", value: "Mine", version: v(s, "en") - 1 },
    ]);
    expect(plan).toEqual({ ok: false, conflicts: ["en"] });
  });
});

describe("the tabs' saved states (issue 412)", () => {
  it("keeps a saved translation as translated, also when kept as is, until it is changed by hand", () => {
    let s = saved({}, [
      { field: "en", value: "Apply today.", version: 0 },
      { field: "fr", value: "Postulez.", version: 0, from: { language: "en", version: 0 } },
    ]);
    expect([s.en?.translated, s.fr?.translated]).toEqual([false, true]);
    s = saved(s, [{ field: "fr", value: "Postulez.", version: v(s, "fr") }]);
    expect(s.fr?.translated).toBe(true);
    s = saved(s, [{ field: "fr", value: "Postulez vite.", version: v(s, "fr") }]);
    expect(s.fr?.translated).toBe(false);
  });

  it("counts a language as reviewed when a request on it or on the whole notice was answered after its save", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 10, 20, h));
    const savedAt = { en: at(10), "pt-BR": at(12), fr: at(9) };
    const answered = (language: "en" | "fr" | null, h: number) => ({
      language,
      outcome: { at: at(h) },
    });
    expect(
      reviewedLanguages(savedAt, [answered("en", 11), { language: "fr", outcome: null }]),
    ).toEqual(["en"]);
    // The whole notice, answered at 11: English and French were saved before, Portuguese after.
    expect(reviewedLanguages(savedAt, [answered(null, 11)])).toEqual(["en", "fr"]);
    expect(reviewedLanguages({}, [answered(null, 11)])).toEqual([]);
  });
});
