"use client";

// The notice editor's lower parts (issue 304): "Show to members" as a switch row and the end date; and the
// save bar, which stays at the bottom of the screen (the tab bar is hidden while editing), with how many
// drafts are left to check, the last error, Save, and Cancel, which asks before throwing changes away.
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { Notice } from "@/lib/brand/components/Notice";
import { Sheet } from "@/lib/brand/components/Sheet";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { NoticeField } from "@/lib/private/notice-rules";

import type { Editor, EditorProps } from "./notice-editor-state";
import { smallButton } from "./NoticeBits";

export function Flags({ e, t }: { e: Editor; t: WorkspaceDictionary }) {
  const set = (field: NoticeField, value: string) => e.set(field, value);
  return (
    <div className="mt-6 space-y-5 border-t border-rule pt-4">
      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-1">
        <span className="flex flex-col">
          <span className="font-semibold">{t["notices.show"]}</span>
          <span className="text-body-sm text-ink/70">{t["notices.show.help"]}</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={e.draft.values.for_members === "true"}
          onChange={(ev) => set("for_members", String(ev.target.checked))}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="relative h-7 w-12 shrink-0 rounded-full border border-rule bg-rule/40 peer-checked:border-plum peer-checked:bg-plum peer-focus-visible:ring-2 peer-focus-visible:ring-plum after:absolute after:top-0.5 after:left-0.5 after:size-[22px] after:rounded-full after:bg-paper after:shadow peer-checked:after:translate-x-5"
        />
      </label>
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
            className="min-h-11 min-w-0 flex-1 border border-rule bg-paper px-3"
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

/** "Discard your changes?" before Cancel throws edits away. */
function Discard({
  t,
  onDiscard,
  onStay,
}: {
  t: WorkspaceDictionary;
  onDiscard: () => void;
  onStay: () => void;
}) {
  return (
    <Sheet role="alertdialog" labelledBy="notice-discard" onCancel={onStay}>
      <p id="notice-discard" className="font-subhead text-display-sm">
        {t["notices.discard.title"]}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          data-initial-focus
          onClick={onStay}
          className={buttonClass("primary")}
        >
          {t["notices.discard.no"]}
        </button>
        <button type="button" onClick={onDiscard} className={buttonClass("secondary")}>
          {t["notices.discard.yes"]}
        </button>
      </div>
    </Sheet>
  );
}

export function SaveBar({ p, e }: { p: EditorProps; e: Editor }) {
  const { t } = p;
  const [asking, setAsking] = useState(false);
  const drafts = Object.keys(e.draft.undo).length;
  const form = new Intl.PluralRules(p.viewer).select(drafts) === "one" ? "one" : "other";
  const leave = () => {
    e.leaving.current = true;
    if (p.onClose) p.onClose();
    else window.location.assign(`/w/${p.slug}/notices`);
  };
  return (
    <div className="sticky bottom-0 z-[5] -mx-4 mt-4 border-t border-rule bg-paper px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
      {e.message && (
        <Notice tone="fail" className="mb-2">
          {t[e.message]}
        </Notice>
      )}
      {drafts > 0 && (
        <p className="mb-1 text-body-sm font-semibold text-plum">
          {fill(t[`notices.drafts.${form}`], { n: drafts })}
        </p>
      )}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={e.busy !== null}
          className={buttonClass("primary", "flex-1 sm:flex-none")}
        >
          {e.busy === "save" ? t["notices.saving"] : t["notices.save"]}
        </button>
        <button
          type="button"
          onClick={() => (e.dirty ? setAsking(true) : leave())}
          className="inline-flex min-h-11 min-w-11 items-center px-2 font-medium underline underline-offset-4"
        >
          {t["notices.cancel"]}
        </button>
      </div>
      {asking && <Discard t={t} onDiscard={leave} onStay={() => setAsking(false)} />}
    </div>
  );
}
