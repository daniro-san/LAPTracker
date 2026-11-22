// The words the Follow-up list and its sheet need in the browser (issue 340), apart from the client
// component so the page (a server component) can read the key list.
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { SHEET_KEYS } from "./sheet-words";

export const FOLLOW_UP_KEYS = [
  ...SHEET_KEYS,
  "followup.talkedNow",
  "followup.card",
  "followup.cardAria",
  "followup.what",
  "followup.action.talked",
  "followup.action.break",
  "followup.action.help",
  "followup.action.fine",
  "followup.until",
  "followup.untilHelp",
  "followup.untilNeed",
  "followup.untilDay",
  "followup.note",
  "followup.noteHelp",
  "followup.save",
  "followup.saved",
  "followup.undo",
  "followup.undone",
  "followup.undoFailed",
  "followup.failed",
  // Needs help (issue 585 S2).
  "followup.helpDone",
  "followup.helpCleared",
  // The panel (issue 460, D140).
  "followup.openHint",
  "followup.pick",
  "followup.why",
  "followup.message",
  "followup.messageHelp",
  "followup.messageLang",
  "followup.lang.en",
  "followup.lang.pt-BR",
  "followup.lang.fr",
  "followup.copyGame",
  "followup.copyDiscord",
  "followup.copied",
  "followup.copyFailed",
  "followup.fill",
  "followup.askTap",
  "followup.notes",
  "followup.noNotes",
  "followup.loading",
  "followup.cardFailed",
  "followup.retry",
  "facts.edit",
  "facts.paste",
] as const;
export type FollowUpWords = Pick<WorkspaceDictionary, (typeof FOLLOW_UP_KEYS)[number]>;

export const followUpWords = (t: WorkspaceDictionary): FollowUpWords =>
  Object.fromEntries(FOLLOW_UP_KEYS.map((k) => [k, t[k]])) as FollowUpWords;
