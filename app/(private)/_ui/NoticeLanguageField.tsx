"use client";

// One language of the notice editor (issues 304, 305): the text with its counter, Translate into the other
// two, Improve writing with its tone chips, the "draft" line with Undo after either, the "may be out of
// date" line, and what someone else saved first. Every button is 44 px high; nothing is hover-only.
import { useState } from "react";

import type { Tone } from "@/lib/ai/notice-writing";
import { fill } from "@/lib/copy";
import type {
  WorkspaceDictionary,
  WorkspaceKey,
  WorkspaceLanguage,
} from "@/lib/private/dictionary";
import type { NoticeLanguage } from "@/lib/private/notice-rules";

import { LANGUAGE_CODE, LANGUAGE_NAME, type Conflict } from "./notice-client";
import { ConflictBox, Counter, smallButton, StaleLine } from "./NoticeBits";

/** Improve writing's chips, in order; a Record, so tsc fails if a tone is left out. */
const TONE_WORDS: Record<Tone, WorkspaceKey> = {
  formal: "notices.tone.formal",
  warmer: "notices.tone.warmer",
  kinder: "notices.tone.kinder",
  direct: "notices.tone.direct",
  shorter: "notices.tone.shorter",
  fix: "notices.tone.fix",
};

export interface LanguageFieldProps {
  language: NoticeLanguage;
  others: NoticeLanguage[];
  value: string;
  onChange: (value: string) => void;
  t: WorkspaceDictionary;
  viewer: WorkspaceLanguage;
  /** Translate and Improve writing are set up (GROQ_API_KEY). */
  ai: boolean;
  /** The action running now, if any: every AI button waits for it. */
  busy: string | null;
  /** The saved text may be out of date, and the language to translate it from. */
  stale: { from: NoticeLanguage | null } | null;
  /** Filled by Translate or Improve writing and not saved yet: Undo puts the text back. */
  drafted: boolean;
  conflict: Conflict | null;
  onTranslate: (from: NoticeLanguage, to: NoticeLanguage[]) => void;
  onImprove: (tone: Tone) => void;
  onUndo: () => void;
  onConflict: (keep: "theirs" | "mine") => void;
}

function AiButtons(p: LanguageFieldProps & { chips: boolean; setChips: (open: boolean) => void }) {
  const { language, others, t, busy } = p;
  const off = !p.ai || busy !== null || p.value.trim() === "";
  const list = others.map((l) => LANGUAGE_CODE[l]).join(" · ");
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={off}
          onClick={() => p.onTranslate(language, others)}
          className={smallButton("text-plum")}
        >
          {busy === `translate:${language}`
            ? t["notices.working"]
            : fill(t["notices.translateTo"], { list })}
        </button>
        <button
          type="button"
          disabled={!p.ai}
          aria-expanded={p.chips}
          onClick={() => p.setChips(!p.chips)}
          className={smallButton("text-plum")}
        >
          {busy === `improve:${language}` ? t["notices.working"] : t["notices.improve"]}
        </button>
      </div>
      {p.chips && (
        <div role="group" aria-label={t["notices.improve"]} className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(TONE_WORDS) as Tone[]).map((tone) => (
            <button
              key={tone}
              type="button"
              disabled={off}
              onClick={() => p.onImprove(tone)}
              className={smallButton("rounded-full")}
            >
              {t[TONE_WORDS[tone]]}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

export function LanguageField(props: LanguageFieldProps) {
  const { language, t, stale, conflict } = props;
  const [chips, setChips] = useState(false);
  const id = `notice-${language}`;
  return (
    <section aria-labelledby={`${id}-label`} className="mt-5 border-t border-rule pt-3">
      <div className="flex items-start justify-between gap-3">
        <label id={`${id}-label`} htmlFor={id} className="font-subhead text-display-sm">
          {LANGUAGE_NAME[language]}
        </label>
        <Counter text={props.value} t={t} />
      </div>
      {stale && (
        <StaleLine t={t}>
          {props.ai && stale.from && (
            <button
              type="button"
              disabled={props.busy !== null}
              onClick={() => stale.from && props.onTranslate(stale.from, [language])}
              className={smallButton("text-plum")}
            >
              {fill(t["notices.translateFrom"], { lang: LANGUAGE_CODE[stale.from] })}
            </button>
          )}
        </StaleLine>
      )}
      {conflict && (
        <ConflictBox
          conflict={conflict}
          t={t}
          language={props.viewer}
          onTheirs={() => props.onConflict("theirs")}
          onMine={() => props.onConflict("mine")}
        />
      )}
      <textarea
        id={id}
        lang={language}
        translate="no"
        rows={8}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-2 block w-full border border-rule bg-paper p-3 leading-relaxed"
      />
      {props.drafted && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-body-sm text-plum">
          <span>{t["notices.draft"]}</span>
          <button type="button" onClick={props.onUndo} className="min-h-11 font-semibold underline">
            {t["notices.undo"]}
          </button>
        </p>
      )}
      <AiButtons {...props} chips={chips} setChips={setChips} />
    </section>
  );
}
