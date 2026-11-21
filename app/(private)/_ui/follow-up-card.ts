// The member card a Follow-up panel holds (issue 460, D140), pure: which read is shown, and what it says.
// Each read has a number (`attempt`); a new one starts after a facts save or a Try again, and until it
// arrives the panel shows "Reading…" with the editor's buttons off, so a second edit never starts from the
// versions before the officer's own save (409). A failed read and a signed-out one say so (D99), never
// "No notes yet".
import type { CardData } from "@/lib/private/member-card";

import { SIGNED_OUT } from "./SignedOut";

/** What a card read answered: the card, the signed-out mark, or null (failed). */
export type CardAnswer = CardData | typeof SIGNED_OUT | null;

/** The newest answer the panel got, with the member and the read it belongs to. */
export type CardRead = { uid: number; attempt: number; answer: CardAnswer } | null;

export type PanelCard =
  { status: "loading" | "failed" | "signed_out"; data: null } | { status: "ok"; data: CardData };

/** The card as the panel shows it, for member `uid` and its read number `attempt`. */
export function panelCard(read: CardRead, uid: number, attempt: number): PanelCard {
  if (!read || read.uid !== uid || read.attempt !== attempt)
    return { status: "loading", data: null };
  if (read.answer === SIGNED_OUT) return { status: "signed_out", data: null };
  return read.answer === null
    ? { status: "failed", data: null }
    : { status: "ok", data: read.answer };
}
