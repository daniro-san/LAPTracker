// The sheet frame's own words (lib/brand/components/Sheet.tsx) from the workspace dictionary: Close,
// Cancel and the "Discard your changes?" question with its two answers.
import type { SheetWords } from "@/lib/brand/components/Sheet";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";

export const SHEET_KEYS = [
  "sheet.close",
  "sheet.cancel",
  "sheet.ask",
  "sheet.keep",
  "sheet.discard",
] as const;

export const sheetWords = (
  t: Pick<WorkspaceDictionary, (typeof SHEET_KEYS)[number]>,
): SheetWords => ({
  close: t["sheet.close"],
  cancel: t["sheet.cancel"],
  ask: t["sheet.ask"],
  keep: t["sheet.keep"],
  discard: t["sheet.discard"],
});
