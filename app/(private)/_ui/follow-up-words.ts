// The words the Follow-up list and its sheet need in the browser (issue 340), apart from the client
// component so the page (a server component) can read the key list.
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

import { SHEET_KEYS } from "./sheet-words";

export const FOLLOW_UP_KEYS = [
  ...SHEET_KEYS,
  "followup.talkedNow",
  "followup.record",
  "followup.inMembers",
  "followup.inMembersAria",
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
] as const;
export type FollowUpWords = Pick<WorkspaceDictionary, (typeof FOLLOW_UP_KEYS)[number]>;

export const followUpWords = (t: WorkspaceDictionary): FollowUpWords =>
  Object.fromEntries(FOLLOW_UP_KEYS.map((k) => [k, t[k]])) as FollowUpWords;
