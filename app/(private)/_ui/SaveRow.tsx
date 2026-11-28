"use client";

// The save row of an Alliance settings card (DESIGN.md "Workspace components", issue 585): Save, off while
// nothing differs from what is saved; "Not saved yet: n changes" in yarn while something does; "Saved." after
// a save; the refusal otherwise. While changes wait, the browser asks before the page is reloaded or closed.
import { Button } from "@/lib/brand/components/Button";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { fill, plural } from "@/lib/words";

import { useLeaveWarning } from "./notice-editor-state";
import { RefusalLine } from "./SignedOut";

export function SaveRow({
  changes,
  busy,
  saved,
  error,
  onSave,
  t,
  language,
  blocked = false,
  savedText,
}: {
  /** How many settings differ from what is saved. */
  changes: number;
  busy: boolean;
  /** The last save went through and nothing changed since. */
  saved: boolean;
  /** The last save's refusal, in words (or the signed-out marker). */
  error: string | null;
  onSave: () => void;
  t: WorkspaceDictionary;
  language: string;
  /** The card cannot be saved as it stands (a title too long): Save stays off. */
  blocked?: boolean;
  /** The card's own "Saved." line, when it has one. */
  savedText?: string;
}) {
  useLeaveWarning(changes > 0);
  const pending = fill(
    plural(changes, { one: t["save.pendingOne"], other: t["save.pending"] }, language),
    { n: changes },
  );
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
      <Button disabled={busy || changes === 0 || blocked} onClick={onSave}>
        {busy ? t["save.saving"] : t["save.button"]}
      </Button>
      <p role="status" className="text-body-sm font-semibold">
        {changes > 0 ? (
          <span className="text-yarn">
            <span aria-hidden="true">● </span>
            {pending}
          </span>
        ) : (
          saved && !error && (savedText ?? t["save.saved"])
        )}
      </p>
      {error && <RefusalLine text={error} className="w-full font-semibold text-seal" />}
    </div>
  );
}
