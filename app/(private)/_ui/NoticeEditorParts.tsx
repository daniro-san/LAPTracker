"use client";

// The notice editor's lower parts (issue 304): "Show to members" (the one on/off control, `check-field`, as
// in the Calendar) and the end date; and the save bar, which stays at the bottom of the screen (the tab bar
// is hidden while editing), with how many drafts are left to check, the last error, Save, and Cancel, which
// asks before throwing changes away. Save and Cancel sit as in every sheet: Save first and widest.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { CheckField } from "@/lib/brand/components/CheckField";
import { FIELD } from "@/lib/brand/components/controls";
import { Notice } from "@/lib/brand/components/Notice";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { NoticeField } from "@/lib/private/notice-rules";

import { AskSheet } from "./AskSheet";
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
  const [asking, setAsking] = useState(false);
  const drafts = Object.keys(e.draft.undo).length;
  const form = new Intl.PluralRules(p.viewer).select(drafts) === "one" ? "one" : "other";
  const leave = () => {
    e.leaving.current = true;
    e.forget();
    if (p.onClose) p.onClose();
    else window.location.assign(`/w/${p.slug}/notices`);
  };
  return (
    <div className="sticky bottom-0 z-[5] -mx-4 mt-4 border-t border-rule bg-paper px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
      {e.message === "signedOut.text" ? (
        <SignedOutNote className="mb-2" />
      ) : (
        e.message && (
          <Notice tone="fail" className="mb-2">
            {t[e.message]}
          </Notice>
        )
      )}
      {/* Always in the page, so a screen reader hears its text change; out of sight while empty. */}
      <p
        aria-live="polite"
        className={drafts > 0 ? "mb-1 text-body-sm font-semibold text-plum" : "sr-only"}
      >
        {drafts > 0 ? fill(t[`notices.drafts.${form}`], { n: drafts }) : ""}
      </p>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={e.busy !== null}
          className={buttonClass("primary", "flex-1 sm:flex-none")}
        >
          {e.busy === "save" ? t["notices.saving"] : t["notices.save"]}
        </button>
        <button
          type="button"
          // Leaving also forgets the text kept on this device, so it asks while that is on offer too.
          onClick={() => (e.dirty || e.restorable ? setAsking(true) : leave())}
          className={buttonClass("secondary")}
        >
          {t["sheet.cancel"]}
        </button>
      </div>
      {asking && (
        <AskSheet
          id="notice-discard"
          question={t["sheet.ask"]}
          yes={t["sheet.discard"]}
          no={t["sheet.keep"]}
          onAnswer={(yes) => (yes ? leave() : setAsking(false))}
        />
      )}
    </div>
  );
}
