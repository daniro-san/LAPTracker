"use client";

// Translate on the Start here editor (D105, on D81's translator through the notices' draft route): from the
// language in view into the other two, one request per part that has text. Each translated language becomes
// a draft in its fields, marked "Draft from Translate, not saved", with Accept and Undo, as in the notices
// editor. Nothing is saved until Save. A part over the translator's 3,000 characters is not sent.
import { useState } from "react";

import { fill } from "@/lib/copy";
import { DRAFT_LIMIT, type NoticeLanguage } from "@/lib/private/notice-rules";
import type { StartHereText } from "@/lib/private/start-here";

import { LANGUAGE_NAME } from "./languages";
import { askDraft } from "./notice-client";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";

type Part = keyof StartHereText;
type Texts = Record<NoticeLanguage, StartHereText>;
const PARTS: Part[] = ["glossary", "rules", "ask"];

export interface TranslateWords {
  button: string;
  /** "to {list}". */
  to: string;
  working: string;
  draft: string;
  accept: string;
  undo: string;
  partly: string;
  off: string;
  tooLong: string;
  timeout: string;
  busy: string;
  failed: string;
}

/** A translated language: its text before the draft (for Undo), and whether it came back partly. */
type Draft = { before: StartHereText; partly: boolean };

export function useTranslate(
  slug: string,
  languages: readonly NoticeLanguage[],
  texts: Texts,
  setTexts: (f: (x: Texts) => Texts) => void,
) {
  const [drafts, setDrafts] = useState<Partial<Record<NoticeLanguage, Draft>>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<keyof TranslateWords | typeof SIGNED_OUT | null>(null);

  async function translate(from: NoticeLanguage) {
    const to = languages.filter((l) => l !== from);
    const parts = PARTS.filter((p) => texts[from][p].trim() !== "");
    setProblem(null);
    if (parts.some((p) => texts[from][p].trim().length > DRAFT_LIMIT)) return setProblem("tooLong");
    setBusy(true);
    const answers = await Promise.all(
      parts.map((p) => askDraft(slug, { kind: "translate", from, to, text: texts[from][p] })),
    );
    setBusy(false);
    const failed = answers.find((a) => "failed" in a);
    if (failed && "failed" in failed) {
      const why = failed.failed;
      return setProblem(
        why === "signedOut.text"
          ? SIGNED_OUT
          : why === "notices.ai.timeout"
            ? "timeout"
            : why === "notices.ai.busy"
              ? "busy"
              : "failed",
      );
    }
    const done = answers.flatMap((a) => ("drafts" in a ? [a] : []));
    setDrafts((d) => ({
      ...d,
      ...Object.fromEntries(
        to.map((l) => [
          l,
          { before: d[l]?.before ?? texts[l], partly: done.some((a) => a.partly.includes(l)) },
        ]),
      ),
    }));
    setTexts((x) => {
      const next = { ...x };
      for (const l of to) {
        next[l] = { ...x[l] };
        parts.forEach((p, i) => (next[l][p] = done[i]?.drafts[l] ?? x[l][p]));
      }
      return next;
    });
  }

  const drop = (l: NoticeLanguage) =>
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== l)));
  const undo = (l: NoticeLanguage) => {
    const before = drafts[l]?.before;
    if (before) setTexts((x) => ({ ...x, [l]: before }));
    drop(l);
  };
  return { drafts, busy, problem, translate, accept: drop, undo, clear: () => setDrafts({}) };
}

export type Translate = ReturnType<typeof useTranslate>;

/** "Translate to …" for the language in view, why it did not run, and its draft mark. */
export function TranslateBar(props: {
  active: NoticeLanguage;
  languages: readonly NoticeLanguage[];
  ai: boolean;
  tr: Translate;
  words: TranslateWords;
  /** The text in view: Translate is off while every part is empty. */
  text: StartHereText;
}) {
  const { tr, words: w } = props;
  const empty = PARTS.every((p) => props.text[p].trim() === "");
  const list = props.languages
    .filter((l) => l !== props.active)
    .map((l) => LANGUAGE_NAME[l])
    .join(", ");
  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={!props.ai || empty || tr.busy}
        onClick={() => void tr.translate(props.active)}
        className="tint-button min-h-11 border border-plum px-3 font-semibold text-plum disabled:opacity-60"
      >
        {tr.busy ? w.working : `${w.button} ${fill(w.to, { list })}`}
      </button>
      {!props.ai && <p className="mt-1 text-body-sm text-ink/75">{w.off}</p>}
      {tr.problem && (
        <RefusalLine
          text={tr.problem === SIGNED_OUT ? SIGNED_OUT : w[tr.problem]}
          className="mt-1 text-body-sm font-semibold"
        />
      )}
      <DraftLine language={props.active} tr={tr} words={w} />
    </div>
  );
}

/** In a translated language's tab: the draft mark, Accept and Undo, and "partly untranslated". */
export function DraftLine(props: {
  language: NoticeLanguage;
  tr: Translate;
  words: TranslateWords;
}) {
  const draft = props.tr.drafts[props.language];
  if (!draft) return null;
  const { words: w, tr, language } = props;
  const small = "min-h-11 min-w-11 px-3 font-semibold underline underline-offset-4";
  return (
    <div className="mt-3 border-l-4 border-plum pl-3">
      <p className="text-body-sm font-semibold text-plum">{w.draft}</p>
      {draft.partly && <p className="text-body-sm">{w.partly}</p>}
      <p className="flex flex-wrap gap-2">
        <button type="button" onClick={() => tr.accept(language)} className={small}>
          {w.accept}
        </button>
        <button type="button" onClick={() => tr.undo(language)} className={small}>
          {w.undo}
        </button>
      </p>
    </div>
  );
}
