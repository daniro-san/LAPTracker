"use client";

// The notice editor's lower parts (issue 304): "Show to members" (the one on/off control, `check-field`, as
// in the Calendar) and the end date; and the save bar, which stays at the bottom of the screen (the tab bar
// is hidden while editing), with how many drafts are left to check, the last error, Save, and Cancel, which
// asks before throwing changes away. Save and Cancel sit as in every sheet: Save first and widest. The bar
// itself is shared with Start here (EditorSaveBar.tsx, D116).
import { CheckField } from "@/lib/brand/components/CheckField";
import { FIELD } from "@/lib/brand/components/controls";
import { Notice } from "@/lib/brand/components/Notice";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { NoticeField } from "@/lib/private/notice-rules";

import { SaveBar as SharedSaveBar } from "./EditorSaveBar";
import type { Editor, EditorProps } from "./notice-editor-state";
import { smallButton } from "./NoticeBits";
import { SignedOutNote } from "./SignedOut";

export function Flags({ e, t }: { e: Editor; t: WorkspaceDictionary }) {
  const set = (field: NoticeField, value: string) => e.set(field, value);
  return (
    <div className="mt-6 space-y-5 border-t border-rule pt-4">
      <CheckField
        label={t["notices.show"]}
        help={t["notices.show.help"]}
        checked={e.draft.values.for_members === "true"}
        onChange={(ev) => set("for_members", String(ev.target.checked))}
      />
      <div>
        <label htmlFor="notice-ends" className="block font-semibold">
          {t["notices.endsOn"]}
        </label>
        <p id="notice-ends-help" className="text-body-sm text-ink/70">
          {t["notices.endsOn.help"]}
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            id="notice-ends"
            type="date"
            aria-describedby="notice-ends-help"
            value={e.draft.values.ends_on}
            onChange={(ev) => set("ends_on", ev.target.value)}
            className={`${FIELD} min-w-0 flex-1`}
          />
          {e.draft.values.ends_on && (
            <button type="button" onClick={() => set("ends_on", "")} className={smallButton()}>
              {t["notices.clear"]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SaveBar({ p, e }: { p: EditorProps; e: Editor }) {
  const { t } = p;
  const leave = () => {
    e.leaving.current = true;
    e.forget();
    if (p.onClose) p.onClose();
    else window.location.assign(`/w/${p.slug}/notices`);
  };
  return (
    <SharedSaveBar
      t={t}
      viewer={p.viewer}
      drafts={Object.keys(e.draft.undo).length}
      saving={e.busy === "save"}
      busy={e.busy !== null}
      note={
        e.message === "signedOut.text" ? (
          <SignedOutNote className="mb-2" />
        ) : (
          e.message && (
            <Notice tone="fail" className="mb-2">
              {t[e.message]}
            </Notice>
          )
        )
      }
      // Leaving also forgets the text kept on this device, so it asks while that is on offer too.
      ask={e.dirty || e.restorable}
      onLeave={leave}
    />
  );
}
