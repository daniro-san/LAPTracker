"use client";

// Parts of the member-facts editor (issue 297, D80), split from FactsEditor.tsx for its size: the paste box,
// the box under a field another officer saved meanwhile, and the note above Save (which fields wait for an
// answer, what was combined).
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import type { FactField } from "@/lib/private/fact-fields";
import { fill, plural } from "@/lib/words";

import { type EditorWords } from "./facts-form";
import { ReadScreenshot, shotWords } from "./ReadScreenshot";

/** What the save bar needs from the editor's save. */
export interface SaveState {
  conflicts: readonly { field: FactField }[];
  merged: readonly FactField[];
  state: "idle" | "saving" | "failed" | "signed_out";
}

export function Paste(props: {
  slug: string;
  words: EditorWords;
  /** False while reading screenshots is turned off for the alliance (D126): no "Read from a screenshot". */
  shots: boolean;
  language: string;
  open: boolean;
  onRead: (text: string) => number;
}) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<number | null>(null);
  const { words } = props;
  return (
    <details open={props.open} className="group drawn-frame-soft px-3 py-2">
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
        className={`${FIELD} mt-2`}
      />
      {/* The picture's text goes into the box and is read at once; the officer still checks and saves. */}
      {props.shots && (
        <ReadScreenshot
          slug={props.slug}
          place="facts"
          link
          words={shotWords(words)}
          onText={(read) => {
            setText(read);
            setFound(props.onRead(read));
          }}
        />
      )}
      <button
        type="button"
        onClick={() => setFound(props.onRead(text))}
        className={buttonClass("primary", "mt-2")}
      >
        {words["paste.read"]}
      </button>
      {found !== null && (
        <p aria-live="polite" className="mt-2 text-body-sm">
          {found === 0
            ? words["paste.nothing"]
            : fill(
                plural(
                  found,
                  { one: words["paste.found.one"] ?? "", other: words["paste.found.other"] ?? "" },
                  props.language,
                ),
                { n: found },
              )}
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
      <p>{fill(words["facts.conflictField"], { theirs, mine })}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => props.onSettle(true)}
          className={buttonClass("secondary")}
        >
          {fill(words["facts.theirs"], { theirs })}
        </button>
        <button
          type="button"
          onClick={() => props.onSettle(false)}
          className={buttonClass("secondary")}
        >
          {fill(words["facts.mine"], { mine })}
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

/** Above Save: the fields that wait for an answer (a link to the first) and what was combined. */
export function SaveNote({ s, words }: { s: SaveState; words: EditorWords }) {
  const names = (fields: readonly FactField[]) => fields.map((x) => words[`facts.${x}`]).join(", ");
  const first = s.conflicts[0]?.field;
  return (
    <>
      {first && (
        <button
          type="button"
          onClick={() => showField(first)}
          className="mb-2 min-h-11 text-left text-body-sm underline underline-offset-4"
        >
          {fill(words["facts.conflictBar"], { field: names(s.conflicts.map((c) => c.field)) })}
        </button>
      )}
      {s.merged.length > 0 && (
        <p aria-live="polite" className="mb-2 text-body-sm">
          {fill(words["facts.mergedLine"], { fields: names(s.merged) })}
        </p>
      )}
    </>
  );
}
