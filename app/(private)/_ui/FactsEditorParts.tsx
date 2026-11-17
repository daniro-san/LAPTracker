"use client";

// Parts of the member-facts editor (issue 297, D80), split from FactsEditor.tsx for its size: the paste box,
// the box under a field another officer saved meanwhile, and the save bar (which fields wait for an answer,
// what was combined, and "Discard changes?").
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import type { FactField } from "@/lib/private/fact-fields";

import { counted, say, type EditorWords } from "./facts-form";

/** What the save bar needs from the editor's save. */
export interface SaveState {
  conflicts: readonly { field: FactField }[];
  merged: readonly FactField[];
  state: "idle" | "saving" | "failed";
  close: () => void;
  save: () => Promise<void>;
}

export function Paste(props: {
  words: EditorWords;
  language: string;
  open: boolean;
  onRead: (text: string) => number;
}) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<number | null>(null);
  const { words } = props;
  return (
    <details open={props.open} className="group border border-rule px-3 py-2">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-semibold text-plum [&::-webkit-details-marker]:hidden">
        <span>{words["facts.paste"]}</span>
        <span aria-hidden="true" className="inline-block group-open:rotate-180">
          ▾
        </span>
      </summary>
      <p className="text-body-sm text-ink/80">{words["paste.help"]}</p>
      <textarea
        {...(props.open && { "data-initial-focus": true })}
        aria-label={words["facts.paste"]}
        value={text}
        rows={4}
        maxLength={4000}
        onChange={(e) => setText(e.target.value)}
        className="mt-2 w-full border border-rule bg-paper px-3 py-2"
      />
      <button
        type="button"
        onClick={() => setFound(props.onRead(text))}
        className={buttonClass("secondary", "mt-2")}
      >
        {words["paste.read"]}
      </button>
      {found !== null && (
        <p aria-live="polite" className="mt-2 text-body-sm">
          {found === 0
            ? words["paste.nothing"]
            : say(counted(words, "paste.found", found, props.language), { n: found })}
        </p>
      )}
    </details>
  );
}

export function Conflict(props: {
  mine: string;
  theirs: string;
  words: EditorWords;
  onSettle: (theirs: boolean) => void;
}) {
  const { words, mine, theirs } = props;
  return (
    <div role="alert" className="mt-2 border border-yarn px-3 py-2 text-body-sm">
      <p>{say(words["facts.conflictField"], { theirs, mine })}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => props.onSettle(true)}
          className={buttonClass("secondary")}
        >
          {say(words["facts.theirs"], { theirs })}
        </button>
        <button
          type="button"
          onClick={() => props.onSettle(false)}
          className={buttonClass("secondary")}
        >
          {say(words["facts.mine"], { mine })}
        </button>
      </div>
    </div>
  );
}

/** Scrolls the sheet (not the page) to a field's label. */
function showField(field: FactField) {
  const label = document.getElementById(`fact-${field}`);
  label
    ?.closest("dialog")
    ?.scrollTo({ top: Math.max(0, label.offsetTop - 24), behavior: "smooth" });
}

export function SaveBar(props: {
  s: SaveState;
  words: EditorWords;
  focusSave: boolean;
  dirty: boolean;
  /** "Discard changes?" is showing. */
  asking: boolean;
  setAsking: (asking: boolean) => void;
}) {
  const { s, words, asking, setAsking } = props;
  const names = (fields: readonly FactField[]) => fields.map((x) => words[`facts.${x}`]).join(", ");
  const first = s.conflicts[0]?.field;
  const leave = () => (props.dirty ? setAsking(true) : s.close());
  const row = "flex gap-3";
  return (
    <div className="sticky -bottom-4 -mb-4 mt-3 border-t border-rule bg-paper pt-3 pb-4 sm:-bottom-6 sm:-mb-6 sm:pb-6">
      {first && (
        <button
          type="button"
          onClick={() => showField(first)}
          className="mb-2 min-h-11 text-left text-body-sm underline underline-offset-4"
        >
          {say(words["facts.conflictBar"], { field: names(s.conflicts.map((c) => c.field)) })}
        </button>
      )}
      {s.merged.length > 0 && (
        <p aria-live="polite" className="mb-2 text-body-sm">
          {say(words["facts.mergedLine"], { fields: names(s.merged) })}
        </p>
      )}
      {asking ? (
        <>
          <p className="mb-2 font-semibold">{words["facts.discard"]}</p>
          <div className={row}>
            <button
              type="button"
              onClick={() => setAsking(false)}
              className={buttonClass("secondary", "flex-1")}
            >
              {words["facts.discardNo"]}
            </button>
            <button type="button" onClick={s.close} className={buttonClass("primary", "flex-1")}>
              {words["facts.discardYes"]}
            </button>
          </div>
        </>
      ) : (
        <div className={row}>
          <button type="button" onClick={leave} className={buttonClass("secondary", "flex-1")}>
            {words["facts.cancel"]}
          </button>
          <button
            type="button"
            {...(props.focusSave && { "data-initial-focus": true })}
            disabled={s.state === "saving" || s.conflicts.length > 0}
            onClick={() => void s.save()}
            className={buttonClass("primary", "flex-1")}
          >
            {words["facts.save"]}
          </button>
        </div>
      )}
    </div>
  );
}
