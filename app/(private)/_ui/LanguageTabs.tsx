"use client";

// EN · PT · FR as tabs (D116, issue 412), each with its state and, on a notice, its text's length: the
// notices editor, a notice's read page and Start here draw the same strip. States: a draft to check (plum
// dot), may be out of date (yarn dot), missing, reviewed (a check), translated (AI), written. Every tab is
// 44 px or more, three across at 360 px; nothing is hover-only. The WAI-ARIA tabs pattern: arrow keys,
// Home and End move and pick, `aria-selected`, and the caller's panel is labelled by its tab.
import { useRef, type KeyboardEvent } from "react";

import { tabAfter } from "@/app/_ui/Movers";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { NOTICE_LIMIT, noticeLength, type NoticeLanguage } from "@/lib/private/notice-rules";

import { LANGUAGE_CODE, LANGUAGE_NAME } from "./languages";
import type { TabState } from "./notice-draft";

const STATE_WORD = {
  draft: "notices.draft.pill",
  stale: "notices.outOfDate",
  written: "notices.tab.written",
  empty: "notices.tab.empty",
  translated: "notices.tab.translated",
  reviewed: "notices.tab.reviewed",
} as const;

/** A dot before the state word for the two that ask for a look: a draft, and out of date. */
const DOT: Partial<Record<TabState, string>> = { draft: "bg-plum", stale: "bg-yarn" };

/** A tab's count beside its code: "812", in seal when over the game's limit (issue 412). */
function TabCount({
  text,
  t,
  language,
}: {
  text: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
}) {
  const n = noticeLength(text);
  if (n === 0) return null;
  const format = new Intl.NumberFormat(language);
  return (
    <span
      className={`text-body-sm font-normal tabular-nums ${n > NOTICE_LIMIT ? "font-semibold text-seal" : "text-ink/70"}`}
    >
      <span aria-hidden="true">{format.format(n)}</span>
      <span className="sr-only">
        {fill(t["notices.chars"], { n: format.format(n), limit: format.format(NOTICE_LIMIT) })}
      </span>
    </span>
  );
}

/**
 * EN · PT · FR as tabs, each with its state, and with `count` its text's length. `id` names the parts:
 * `${id}-tabs`, `${id}-tab-${language}`, and the panel the caller draws, `${id}-panel`. The notices editor,
 * a notice's read page (issue 412) and Start here use it.
 */
export function LanguageTabs(props: {
  id: string;
  t: WorkspaceDictionary;
  languages: readonly NoticeLanguage[];
  active: NoticeLanguage;
  stateOf: (language: NoticeLanguage) => TabState;
  onPick: (language: NoticeLanguage) => void;
  count?: { text: (language: NoticeLanguage) => string; language: WorkspaceLanguage };
}) {
  const { id, t, languages, count } = props;
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (ev: KeyboardEvent, i: number) => {
    const next = tabAfter(ev.key, i, languages.length);
    const language = next === null ? undefined : languages[next];
    if (next === null || !language) return;
    ev.preventDefault();
    props.onPick(language);
    buttons.current[next]?.focus();
  };
  return (
    <div
      id={`${id}-tabs`}
      role="tablist"
      aria-label={t["notices.languages"]}
      className="mt-5 grid scroll-mt-4 grid-cols-3 border-b border-rule"
    >
      {languages.map((language, i) => {
        const state = props.stateOf(language);
        const selected = language === props.active;
        return (
          <button
            key={language}
            ref={(el) => {
              buttons.current[i] = el;
            }}
            id={`${id}-tab-${language}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${id}-panel`}
            tabIndex={selected ? 0 : -1}
            onClick={() => props.onPick(language)}
            onKeyDown={(ev) => onKey(ev, i)}
            className="tint-button flex min-h-14 flex-col items-center justify-center px-1 text-center aria-selected:bg-plum/10 aria-selected:shadow-[inset_0_-3px_0_var(--color-plum)]"
          >
            <span className="flex items-baseline gap-1.5">
              <span className="sr-only">{LANGUAGE_NAME[language]}</span>
              <span aria-hidden="true" className="font-semibold">
                {LANGUAGE_CODE[language]}
              </span>
              {count && <TabCount text={count.text(language)} t={t} language={count.language} />}
            </span>
            <span
              className={`flex items-center gap-1 text-[12px] leading-tight whitespace-nowrap ${
                state === "draft"
                  ? "font-semibold text-plum"
                  : state === "stale"
                    ? "font-semibold text-yarn"
                    : "text-ink"
              }`}
            >
              {DOT[state] && (
                <span aria-hidden="true" className={`size-2 rounded-full ${DOT[state]}`} />
              )}
              {state === "reviewed" && <span aria-hidden="true">✓</span>}
              {t[STATE_WORD[state]]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
