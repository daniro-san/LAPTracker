// The member card's "Talked to them" and Undo (issue 516): what each answer leaves on the card. A Talked
// that is stored and not undone keeps Undo and keeps Talked off, so a failed Undo never invites a second
// Talked (review of PR 633). Invented request ids.
import { describe, expect, it } from "vitest";

import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";

import { afterTalked, afterUndo, doneView, type Done } from "./card-follow-up-state";

const w = WORKSPACE_DICTIONARIES.en;
const saved = (onList: boolean): Done => ({
  requestId: "6f1c2a9e-1b2d-4c3e-8f4a-5b6c7d8e9f01",
  onList,
  state: afterTalked(200),
});
const view = (done: Done) => {
  const v = doneView(done, w);
  return v && { text: v.text, undo: v.undo, talkedOff: v.talkedOff };
};

describe("the member card's Talked and Undo (issue 516)", () => {
  it("says off the Follow-up list until Monday only for a member who was on it", () => {
    expect(view(saved(true))).toEqual({
      text: "Saved. Off the Follow-up list until Monday.",
      undo: true,
      talkedOff: true,
    });
    expect(view(saved(false))).toEqual({ text: "Saved.", undo: true, talkedOff: true });
    expect(view({ ...saved(true), state: afterUndo(200) })).toEqual({
      text: "Undone.",
      undo: false,
      talkedOff: false,
    });
  });

  it("keeps Undo and Talked off after an Undo that failed, got no answer or was signed out", () => {
    const after = (status: number | undefined) =>
      view({ ...saved(true), state: afterUndo(status) });
    expect(after(500)).toEqual({ text: "Could not undo. Try again.", undo: true, talkedOff: true });
    expect(after(undefined)).toEqual({
      text: "Could not undo. Try again.",
      undo: true,
      talkedOff: true,
    });
    // The signed-out line (D99) instead of words; the Talked is still stored.
    expect(after(401)).toEqual({ text: null, undo: true, talkedOff: true });
    // Refused because the notes changed since: the card is read again and shows what is stored.
    expect(after(409)).toEqual({
      text: "Could not undo: the notes changed since.",
      undo: false,
      talkedOff: false,
    });
  });
});
