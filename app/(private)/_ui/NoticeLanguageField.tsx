"use client";

// The notice's text (issues 304, 305, 363): one tab per language, EN · PT · FR, each with a small state
// (empty, written, a draft to check, may be out of date), and one text box for the tab in view, which grows
// with what is written. In the tab in view: "may be out of date" with "Update from …" and "Keep as is"; a
// draft's mark ("Draft from Translate, not saved"), Accept and Undo, and "Partly untranslated"; the counter
// and how far over the game's limit the text is. The tabs follow the WAI-ARIA pattern (arrow keys, Home,
// End); every control is 44 px; nothing is hover-only.
import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

import { tabAfter } from "@/app/_ui/Movers";
import { FIELD } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";
import { NOTICE_LIMIT, noticeLength, type NoticeLanguage } from "@/lib/private/notice-rules";

import { LANGUAGE_CODE, LANGUAGE_NAME } from "./languages";
import { draftKind, tabState, type TabState } from "./notice-draft";
import type { Editor, EditorProps } from "./notice-editor-state";
import { Counter, OverLimit, smallButton, StaleLine } from "./NoticeBits";

const STATE_WORD = {
  draft: "notices.draft.pill",
  stale: "notices.outOfDate",
  written: "notices.tab.written",
  empty: "notices.tab.empty",
} as const;

/** A dot before the state word for the two that ask for a look: a draft, and out of date. */
const DOT: Partial<Record<TabState, string>> = { draft: "bg-plum", stale: "bg-yarn" };

function Tabs({ p, e }: { p: EditorProps; e: Editor }) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const { t } = p;
  const onKey = (ev: KeyboardEvent, i: number) => {
    const next = tabAfter(ev.key, i, p.languages.length);
    const language = next === null ? undefined : p.languages[next];
    if (next === null || !language) return;
    ev.preventDefault();
    e.setActive(language);
    buttons.current[next]?.focus();
  };
  return (
    <div
      id="notice-tabs"
      role="tablist"
      aria-label={t["notices.languages"]}
      className="mt-5 grid scroll-mt-4 grid-cols-3 border-b border-rule"
    >
      {p.languages.map((language, i) => {
        const state = tabState(e.draft, language, p.stale.includes(language));
        const selected = language === e.active;
        return (
          <button
            key={language}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            id={`notice-tab-${language}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="notice-panel"
            tabIndex={selected ? 0 : -1}
            onClick={() => e.setActive(language)}
            onKeyDown={(ev) => onKey(ev, i)}
            className="tint-button flex min-h-14 flex-col items-center justify-center px-1 text-center aria-selected:bg-plum/10 aria-selected:shadow-[inset_0_-3px_0_var(--color-plum)]"
          >
            <span className="sr-only">{LANGUAGE_NAME[language]}</span>
            <span aria-hidden="true" className="font-semibold">
              {LANGUAGE_CODE[language]}
            </span>
            <span
              className={`flex items-center gap-1 text-[12px] leading-tight ${
                state === "draft"
                  ? "font-semibold text-plum"
                  : state === "stale"
                    ? "font-semibold text-yarn"
                    : "text-ink/70"
              }`}
            >
              {DOT[state] && (
                <span aria-hidden="true" className={`size-2 rounded-full ${DOT[state]}`} />
              )}
              {t[STATE_WORD[state]]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

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

/** A draft in the tab in view: where it came from, Accept and Undo, and "Partly untranslated". */
function DraftMark({ p, e }: { p: EditorProps; e: Editor }) {
  const { t } = p;
  const language = e.active;
  const kind = draftKind(e.draft, language);
  if (!kind) return null;
  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="flex min-w-0 flex-1 basis-48 items-center gap-2 text-body-sm font-semibold text-plum">
          <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-plum" />
          {fill(t[`notices.draft.${kind}`], {
            limit: new Intl.NumberFormat(p.viewer).format(NOTICE_LIMIT),
          })}
        </p>
        <span className="flex gap-2">
          <button
            type="button"
            onClick={() => e.accept(language)}
            className={smallButton("border-plum font-semibold text-plum")}
          >
            {t["notices.accept"]}
          </button>
          <button type="button" onClick={() => e.undo(language)} className={smallButton()}>
            {t["notices.undo"]}
          </button>
        </span>
      </div>
      {e.draft.partly[language] && (
        <p role="status" className="mt-1 text-body-sm font-semibold text-seal">
          {t["notices.draft.partly"]}
        </p>
      )}
    </div>
  );
}

export function LanguageField({ p, e }: { p: EditorProps; e: Editor }) {
  const { t } = p;
  const language = e.active;
  const value = e.draft.values[language];
  const stale = tabState(e.draft, language, p.stale.includes(language)) === "stale";
  const from = p.source !== language ? p.source : null;
  return (
    <>
      <Tabs p={p} e={e} />
      <div id="notice-panel" role="tabpanel" aria-labelledby={`notice-tab-${language}`}>
        {stale && (
          <StaleLine t={t}>
            {p.ai && from && (
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
        <DraftMark p={p} e={e} />
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
          <OverLimit text={value} t={t} id="notice-over" />
          <span className="shrink-0">
            <Counter text={value} t={t} />
          </span>
        </div>
      </div>
    </>
  );
}
