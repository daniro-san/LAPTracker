// The glossary card's Undo (#832): a removal is undone on top of the words saved now, not on an old copy.
import { describe, expect, it } from "vitest";

import { GLOSSARY_MAX_WORDS, undoList } from "./glossary";

describe("undoList", () => {
  it("keeps a word added since the removal, and adds the removed one once", () => {
    expect(undoList(["Elixir Scramble", "Newcomer"], "[ZZZ]")).toEqual([
      "Elixir Scramble",
      "Newcomer",
      "[ZZZ]",
    ]);
    // The word was typed again after the removal: nothing doubles.
    expect(undoList(["[zzz]"], "[ZZZ]")).toEqual(["[zzz]"]);
    // A full list is left as it is rather than going over the cap.
    const full = Array.from({ length: GLOSSARY_MAX_WORDS }, (_, i) => `W${i}`);
    expect(undoList(full, "[ZZZ]")).toEqual(full);
  });
});
