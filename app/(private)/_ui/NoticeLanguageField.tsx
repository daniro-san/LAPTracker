"use client";

// One language of the notice editor (issues 304, 305): the text, which grows with what is written, its
// counter and how far over the game's limit it is; "Translate to …" and, lighter, "Improve writing" with its
// tone chips; a draft from either in a tinted box with Undo; and, when the saved text may be out of date,
// "Update from …" and "Keep as is". Every control is 44 px; nothing is hover-only.
import { useLayoutEffect, useRef, useState } from "react";

import type { Tone } from "@/lib/ai/notice-writing";
import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import type {
  WorkspaceDictionary,
  WorkspaceKey,
  WorkspaceLanguage,
} from "@/lib/private/dictionary";
import {
  DRAFT_LIMIT,
  NOTICE_LIMIT,
  noticeLength,
  type NoticeLanguage,
} from "@/lib/private/notice-rules";

import { LANGUAGE_NAME } from "./languages";
import { Counter, OverLimit, smallButton, StaleLine } from "./NoticeBits";

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
  /** The saved text may be out of date, and the language to update it from. */
  stale: { from: NoticeLanguage | null } | null;
  /** Filled by Translate or Improve writing and not saved yet: Undo puts the text back. */
  drafted: boolean;
  /** The translation came back partly untranslated even after its retry (D81). */
  partly: boolean;
  /** Another language has text, which Translate would turn into a draft. */
  othersWritten: boolean;
  onTranslate: (from: NoticeLanguage, to: NoticeLanguage[]) => void;
  onImprove: (tone: Tone) => void;
  onUndo: () => void;
  onKeep: () => void;
}

/** The text box, as tall as its text: no inner scroll and no resize handle. */
function GrowingText({ p, describedBy }: { p: LanguageFieldProps; describedBy: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight + 2}px`;
  }, [p.value]);
  const over = noticeLength(p.value) > NOTICE_LIMIT;
  return (
    <textarea
      ref={ref}
      id={`notice-${p.language}`}
      lang={p.language}
      translate="no"
      rows={4}
      value={p.value}
      aria-describedby={describedBy}
      onChange={(e) => p.onChange(e.target.value)}
      className={`block w-full resize-none overflow-hidden border bg-paper p-3 leading-relaxed ${
        over ? "border-seal ring-2 ring-seal" : "border-rule"
      }`}
    />
  );
}

/** Why Translate and Improve writing are off, said on the buttons themselves. */
function reasonOf(p: LanguageFieldProps): WorkspaceKey | null {
  if (!p.ai) return "notices.ai.off";
  return p.value.length > DRAFT_LIMIT ? "notices.ai.tooLong" : null;
}

function AiButtons(p: LanguageFieldProps) {
  const { language, others, t, busy } = p;
  const [chips, setChips] = useState(false);
  const reason = reasonOf(p);
  const off = reason !== null || busy !== null || p.value.trim() === "";
  const reasonId = `notice-${language}-ai-reason`;
  const described = reason ? { "aria-describedby": reasonId } : {};
  const list = new Intl.ListFormat(p.viewer, { type: "conjunction" }).format(
    others.map((l) => LANGUAGE_NAME[l]),
  );
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={off}
          {...described}
          onClick={() => p.onTranslate(language, others)}
          className={buttonClass("secondary", "text-body-sm text-plum")}
        >
          {busy === `translate:${language}`
            ? t["notices.working"]
            : fill(t["notices.translateTo"], { list })}
        </button>
        <button
          type="button"
          disabled={reason !== null}
          {...described}
          aria-expanded={chips}
          onClick={() => setChips(!chips)}
          className="inline-flex min-h-11 min-w-11 items-center px-2 text-body-sm font-medium text-plum underline underline-offset-4 disabled:opacity-50"
        >
          {busy === `improve:${language}` ? t["notices.working"] : t["notices.improve"]}
        </button>
      </div>
      {reason ? (
        <p id={reasonId} className="mt-1 text-body-sm text-ink/75">
          {fill(t[reason], { limit: DRAFT_LIMIT })}
        </p>
      ) : (
        p.othersWritten && (
          <p className="mt-1 text-body-sm text-ink/70">{t["notices.translateNote"]}</p>
        )
      )}
      {chips && reason === null && (
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

export function LanguageField(p: LanguageFieldProps) {
  const { language, t, stale } = p;
  const id = `notice-${language}`;
  const box = <GrowingText p={p} describedBy={`${id}-over`} />;
  return (
    <section aria-labelledby={`${id}-label`} className="mt-5 border-t border-rule pt-3">
      <div className="flex items-start justify-between gap-3">
        <label id={`${id}-label`} htmlFor={id} className="font-subhead text-display-sm">
          {LANGUAGE_NAME[language]}
        </label>
        <Counter text={p.value} t={t} />
      </div>
      {stale && (
        <StaleLine t={t}>
          {p.ai && stale.from && (
            <button
              type="button"
              disabled={p.busy !== null}
              onClick={() => stale.from && p.onTranslate(stale.from, [language])}
              className={smallButton("text-plum")}
            >
              {fill(t["notices.updateFrom"], { lang: LANGUAGE_NAME[stale.from] })}
            </button>
          )}
          <button type="button" onClick={p.onKeep} className={smallButton()}>
            {t["notices.keep"]}
          </button>
        </StaleLine>
      )}
      {p.drafted ? (
        <div className="mt-2 border-l-4 border-plum bg-plum/5 py-2 pr-2 pl-3">
          <p className="mb-2 flex flex-wrap items-center gap-2 text-body-sm">
            <span className="rounded-full bg-plum px-2 py-0.5 text-[12px] font-semibold text-paper">
              {t["notices.draft.pill"]}
            </span>
            <span className="text-plum">{t["notices.draft"]}</span>
            <button type="button" onClick={p.onUndo} className={smallButton("ml-auto bg-paper")}>
              {t["notices.undo"]}
            </button>
          </p>
          {p.partly && (
            <p role="status" className="mb-2 text-body-sm font-semibold text-seal">
              {t["notices.draft.partly"]}
            </p>
          )}
          {box}
        </div>
      ) : (
        <div className="mt-2">{box}</div>
      )}
      <OverLimit text={p.value} t={t} id={`${id}-over`} />
      <AiButtons {...p} />
    </section>
  );
}
