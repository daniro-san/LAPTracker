"use client";

// Alliance settings → Glossary (#832, D81 amendment): the words the alliance's translations never change. Each
// add or remove is one save of the whole list (no Save button: a word is one decision), and a remove offers
// Undo for a few seconds, which saves the list as it was. Shown only while a translating feature is on (D126).
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/lib/brand/components/Button";
import { chip, FIELD } from "@/lib/brand/components/controls";
import { cleanWord, GLOSSARY_MAX_WORDS } from "@/lib/glossary";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { fill } from "@/lib/words";

import { UndoLine } from "./DeleteRecord";
import { SIGNED_OUT, RefusalLine } from "./SignedOut";

/** The refusal in words: signed out, too many saves, or anything else. */
function refusal(status: number | undefined, t: WorkspaceDictionary) {
  if (status === 401) return SIGNED_OUT;
  if (status === 429) return t["glossary.rateLimited"];
  return t["glossary.failed"];
}

/** The saved list, and `save`, which posts a whole list and says why it was refused, or null. */
function useGlossary(slug: string, saved: string[], t: WorkspaceDictionary) {
  const router = useRouter();
  const [words, setWords] = useState(saved);
  const [busy, setBusy] = useState(false);
  const save = async (next: string[]): Promise<string | null> => {
    setBusy(true);
    const res = await fetch(`/api/w/${slug}/glossary`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ words: next }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return refusal(res?.status, t);
    setWords(((await res.json()) as { words: string[] }).words);
    // The page's "On this page" row counts the words.
    router.refresh();
    return null;
  };
  return { words, busy, save };
}

/** The field, its label and the Add button. */
function AddWord(props: {
  t: WorkspaceDictionary;
  draft: string;
  onDraft: (text: string) => void;
  busy: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  const { t } = props;
  return (
    <form onSubmit={props.onSubmit} className="mt-4">
      <label htmlFor="glossary-word" className="font-medium">
        {t["glossary.label"]}
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          id="glossary-word"
          type="text"
          value={props.draft}
          onChange={(e) => props.onDraft(e.target.value)}
          aria-describedby="glossary-count"
          autoComplete="off"
          className={`${FIELD} min-w-0 flex-1 text-[16px]`}
        />
        <Button type="submit" disabled={props.busy || props.draft.trim() === ""}>
          {t["glossary.add"]}
        </Button>
      </div>
    </form>
  );
}

/** The words as chips, each a button that removes it. */
function WordList(props: {
  t: WorkspaceDictionary;
  words: string[];
  busy: boolean;
  onRemove: (word: string) => void;
}) {
  const { t } = props;
  return (
    <>
      {props.words.length === 0 ? (
        <p className="mt-3 text-ink/75">{t["glossary.empty"]}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2 ph-no-capture">
          {props.words.map((w) => (
            <li key={w}>
              <button
                type="button"
                disabled={props.busy}
                aria-label={fill(t["glossary.remove"], { word: w })}
                onClick={() => props.onRemove(w)}
                className={`${chip()} break-all`}
              >
                {w} <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function GlossaryCard(props: {
  slug: string;
  words: string[];
  t: WorkspaceDictionary;
  language: string;
}) {
  const { t } = props;
  const { words, busy, save } = useGlossary(props.slug, props.words, t);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** The last word removed and the list before it, while Undo is offered. */
  const [removed, setRemoved] = useState<{ word: string; before: string[]; n: number } | null>(
    null,
  );
  const full = words.length >= GLOSSARY_MAX_WORDS;
  const word = cleanWord(draft);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (word === null) return setError(t["glossary.invalid"]);
    if (full) return setError(t["glossary.full"]);
    setError(null);
    const failed = await save([...words, word]);
    if (failed) return setError(failed);
    setDraft("");
  };
  const remove = async (gone: string) => {
    setError(null);
    const before = words;
    const failed = await save(words.filter((w) => w !== gone));
    if (failed) return setError(failed);
    setRemoved({ word: gone, before, n: (removed?.n ?? 0) + 1 });
  };
  return (
    <section aria-labelledby="glossary" className="drawn-card mt-6 max-w-2xl px-4 py-3">
      <h2 id="glossary" className="font-subhead text-display-sm">
        {t["glossary.head"]}
      </h2>
      <p className="mt-1">{t["glossary.lead"]}</p>
      <AddWord t={t} draft={draft} onDraft={setDraft} busy={busy} onSubmit={(e) => void add(e)} />
      <p id="glossary-count" className="mt-1 text-body-sm tabular-nums text-ink/75">
        {fill(t["glossary.count"], { n: words.length })}
      </p>
      {error && <RefusalLine text={error} className="mt-1 font-semibold text-seal" />}
      <WordList t={t} words={words} busy={busy} onRemove={(w) => void remove(w)} />
      {removed && (
        <UndoLine
          key={removed.n}
          done={fill(t["glossary.removed"], { word: removed.word })}
          undo={t["glossary.undo"]}
          failed={t["glossary.undoFailed"]}
          onUndo={async () => {
            const failed = await save(removed.before);
            if (!failed) setRemoved(null);
            return failed === null;
          }}
        />
      )}
    </section>
  );
}
