"use client";

// The sticky save bar both language editors share (D116): the notices editor and Start here.
import { useState, type ReactNode } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";

import { AskSheet } from "./AskSheet";

/**
 * The save bar, at the bottom of the screen while the form is open (the tab bar is hidden while a form
 * marked `data-notice-editor` is in the page): what is left to check, the last outcome, Save first and
 * widest, and Cancel, which asks before throwing changes away.
 */
export function SaveBar(props: {
  t: WorkspaceDictionary;
  viewer: WorkspaceLanguage;
  /** How many drafts are left to Accept or Undo. */
  drafts: number;
  saving: boolean;
  /** Save waits while anything runs (a save, Translate, Improve writing). */
  busy: boolean;
  /** The last outcome (an error, "Saved"), above the buttons. */
  note: ReactNode;
  /** Cancel asks first. */
  ask: boolean;
  onLeave: () => void;
}) {
  const { t, drafts } = props;
  const [asking, setAsking] = useState(false);
  const form = new Intl.PluralRules(props.viewer).select(drafts) === "one" ? "one" : "other";
  return (
    <div className="sticky bottom-0 z-[5] -mx-4 mt-4 border-t border-rule bg-paper px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6">
      {props.note}
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
          disabled={props.busy}
          className={buttonClass("primary", "flex-1 sm:flex-none")}
        >
          {props.saving ? t["notices.saving"] : t["notices.save"]}
        </button>
        <button
          type="button"
          onClick={() => (props.ask ? setAsking(true) : props.onLeave())}
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
          onAnswer={(yes) => (yes ? props.onLeave() : setAsking(false))}
        />
      )}
    </div>
  );
}
