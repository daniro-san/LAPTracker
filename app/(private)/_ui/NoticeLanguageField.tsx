"use client";

// The notice's text (issues 304, 305, 363): one tab per language, EN · PT · FR, each with a small state
// (missing, written, translated, reviewed, a draft to check, may be out of date; issue 412) and its length,
// and one text box for the tab in view, which grows
// with what is written. In the tab in view: "may be out of date" with "Update from …" and "Keep as is"; a
// draft's mark ("Draft from Translate, not saved"), Accept and Undo, and "Partly untranslated"; the counter
// and how far over the game's limit the text is. The tabs and the draft mark are shared with Start here
// (LanguageTabs.tsx and LanguageEditorParts.tsx, D116).
import { useLayoutEffect, useRef } from "react";

import { FIELD } from "@/lib/brand/components/controls";
import { NOTICE_LIMIT, noticeLength, type NoticeLanguage } from "@/lib/private/notice-rules";
import { fill } from "@/lib/words";

import { DraftMark } from "./LanguageEditorParts";
import { LANGUAGE_NAME } from "./languages";
import { LanguageTabs } from "./LanguageTabs";
import { draftKind, tabState } from "./notice-draft";
import type { Editor, EditorProps } from "./notice-editor-state";
import { Counter, OverLimit, smallButton, StaleLine } from "./NoticeBits";

/** The text box, as tall as its text: no inner scroll and no resize handle. */
function GrowingText({
  language,
  value,
  drafted,
  onChange,
}: {
  language: NoticeLanguage;
  value: string;
  drafted: boolean;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight + 2}px`;
  }, [value]);
  const over = noticeLength(value) > NOTICE_LIMIT;
  return (
    <textarea
      ref={ref}
      id="notice-text"
      lang={language}
      translate="no"
      rows={6}
      value={value}
      aria-label={LANGUAGE_NAME[language]}
      aria-describedby="notice-over"
      onChange={(ev) => onChange(ev.target.value)}
      aria-invalid={over}
      className={`${FIELD} block resize-none overflow-hidden p-3 leading-relaxed ${drafted ? "bg-plum/5" : ""}`}
    />
  );
}

export function LanguageField({ p, e }: { p: EditorProps; e: Editor }) {
  const { t } = p;
  const language = e.active;
  const value = e.draft.values[language];
  const stale = tabState(e.draft, language, p) === "stale";
  const from = p.source !== language ? p.source : null;
  return (
    <>
      <LanguageTabs
        id="notice"
        t={t}
        languages={p.languages}
        active={language}
        stateOf={(l) => tabState(e.draft, l, p)}
        count={{ text: (l) => e.draft.values[l], language: p.viewer }}
        onPick={e.setActive}
      />
      <div id="notice-panel" role="tabpanel" aria-labelledby={`notice-tab-${language}`}>
        {stale && (
          <StaleLine t={t}>
            {p.ai && !p.aiOff?.includes("translate") && from && (
              <button
                type="button"
                disabled={e.busy !== null}
                onClick={() => void e.translate(from, [language])}
                className={smallButton("text-plum")}
              >
                {fill(t["notices.updateFrom"], { lang: LANGUAGE_NAME[from] })}
              </button>
            )}
            <button type="button" onClick={() => e.keep(language)} className={smallButton()}>
              {t["notices.keep"]}
            </button>
          </StaleLine>
        )}
        <DraftMark
          t={t}
          viewer={p.viewer}
          kind={draftKind(e.draft, language)}
          partly={e.draft.partly[language] === true}
          onAccept={() => e.accept(language)}
          onUndo={() => e.undo(language)}
        />
        <div className="mt-3">
          <GrowingText
            key={language}
            language={language}
            value={value}
            drafted={draftKind(e.draft, language) !== null}
            onChange={(v) => e.set(language, v)}
          />
        </div>
        <div className="mt-1 flex items-start justify-between gap-3">
          <OverLimit text={value} t={t} language={p.viewer} id="notice-over" />
          <span className="shrink-0">
            <Counter text={value} t={t} language={p.viewer} />
          </span>
        </div>
      </div>
    </>
  );
}
