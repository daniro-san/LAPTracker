// What the member card's "Talked to them" and its Undo led to (issue 516), pure: the line under the
// buttons, whether Undo is offered and whether Talked is off. While a Talked is stored and not undone,
// Undo stays and Talked stays off, so a failed Undo never invites a second Talked (review of PR 633). A
// refused Undo (409: the notes changed since) reads the card again, which shows what is stored, and frees
// Talked.
import type { CardFollowUpWords } from "@/lib/private/card-follow-up";

/** The last tap's outcome; `requestId` is the Talked's, the record an Undo withdraws. */
export type Done = {
  requestId: string;
  state:
    "saved" | "failed" | "signed_out" | "undone" | "changed" | "undo_failed" | "undo_signed_out";
  onList: boolean;
};

/** A Talked's answer (`send`'s status, undefined when none came back). */
export const afterTalked = (status: number | undefined): Done["state"] =>
  status === 200 ? "saved" : status === 401 ? "signed_out" : "failed";

/** An Undo's answer: the Talked stays stored unless it went through (200) or the notes changed (409). */
export const afterUndo = (status: number | undefined): Done["state"] =>
  status === 200
    ? "undone"
    : status === 409
      ? "changed"
      : status === 401
        ? "undo_signed_out"
        : "undo_failed";

/** The Talked is stored and still the card's to undo. */
const pending = (d: Done) => ["saved", "undo_failed", "undo_signed_out"].includes(d.state);

export interface DoneView {
  /** The line's words; null for the signed-out line (D99). */
  text: string | null;
  /** A refusal (seal, `role="alert"`) rather than a plain status. */
  error: boolean;
  undo: boolean;
  /** Talked is off: a second tap would store a second record. */
  talkedOff: boolean;
}

export function doneView(done: Done | null, w: CardFollowUpWords): DoneView | null {
  if (!done) return null;
  const view = { undo: pending(done), talkedOff: pending(done) };
  switch (done.state) {
    case "saved":
      return {
        ...view,
        text: w[done.onList ? "card.followup.savedList" : "card.followup.saved"],
        error: false,
      };
    case "undone":
      return { ...view, text: w["card.followup.undone"], error: false };
    case "changed":
      return { ...view, text: w["card.followup.undoChanged"], error: true };
    case "failed":
      return { ...view, text: w["followup.failed"], error: true };
    case "undo_failed":
      return { ...view, text: w["card.followup.undoFailed"], error: true };
    default:
      return { ...view, text: null, error: true };
  }
}
