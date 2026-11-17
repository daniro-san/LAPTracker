"use client";

// The small parts both notice screens show (issue 304): a language's counter ("512 / 1000") and, under the
// text, how far over the game's limit it is (a soft warning, never a block); the "may be out of date" line
// and tag; and the one banner that says someone else saved first, with each field side by side.
import type { ReactNode, Ref } from "react";

import { chip } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { NOTICE_LIMIT, noticeLength } from "@/lib/private/notice-rules";

import { fieldName, valueWords, type Conflict } from "./notice-client";

/** Every small control: 44 px both ways. */
export const smallButton = (extra = "") => `${chip()} min-w-11 justify-center ${extra}`;

export function Counter({ text, t }: { text: string; t: WorkspaceDictionary }) {
  const n = noticeLength(text);
  return (
    <span
      aria-label={fill(t["notices.chars"], { n, limit: NOTICE_LIMIT })}
      className={`text-body-sm tabular-nums ${n > NOTICE_LIMIT ? "font-semibold text-seal" : "text-ink/70"}`}
    >
      {n} / {NOTICE_LIMIT}
    </span>
  );
}

/** Under the text: "5 over the game's 1000 limit. The end may be cut.", announced when it changes. */
export function OverLimit({ text, t, id }: { text: string; t: WorkspaceDictionary; id?: string }) {
  const over = noticeLength(text) - NOTICE_LIMIT;
  return (
    <p id={id} aria-live="polite" className="text-left text-body-sm font-semibold text-seal">
      {over > 0 ? fill(t["notices.over"], { n: over, limit: NOTICE_LIMIT }) : ""}
    </p>
  );
}

/** In the editor: "This version may be out of date. Translate again?" and what can be done about it. */
export function StaleLine({ t, children }: { t: WorkspaceDictionary; children: ReactNode }) {
  return (
    <div className="mt-2 border-l-4 border-yarn pl-3">
      <p className="text-body-sm font-semibold text-yarn">{t["notices.stale"]}</p>
      <div className="mt-1 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/** On the read page: a compact tag beside the language's name that opens the editor. */
export function OutOfDateTag({
  label,
  onOpen,
  t,
}: {
  label: string;
  onOpen: () => void;
  t: WorkspaceDictionary;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className="drawn-frame-soft inline-flex min-h-11 items-center px-3 text-body-sm font-semibold text-yarn"
    >
      {t["notices.outOfDate"]}
    </button>
  );
}

/**
 * Someone saved first (issue 293): one banner at the top of the editor, focused when it appears, with each
 * field they changed beside the officer's own text, and the two answers for all of them.
 */
export function ConflictBanner({
  conflicts,
  mine,
  t,
  onKeepMine,
  onUseTheirs,
  focusRef,
}: {
  conflicts: Conflict[];
  mine: (field: Conflict["field"]) => string;
  t: WorkspaceDictionary;
  onKeepMine: () => void;
  onUseTheirs: () => void;
  focusRef: Ref<HTMLDivElement>;
}) {
  const name = conflicts.find((c) => c.by)?.by ?? t["notices.someone"];
  return (
    <div
      ref={focusRef}
      role="alert"
      tabIndex={-1}
      className="mt-3 scroll-mt-4 border-l-4 border-seal bg-seal/5 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-seal"
    >
      <p className="font-semibold">{fill(t["notices.conflict.banner"], { name })}</p>
      {/* The answers right after "Choose what to keep:", so a long text never pushes them out of view. */}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={onKeepMine} className={smallButton("bg-paper")}>
          {t["notices.conflict.mine"]}
        </button>
        <button type="button" onClick={onUseTheirs} className={smallButton("bg-paper")}>
          {fill(t["notices.conflict.theirs"], { name })}
        </button>
      </div>
      <dl className="mt-3 space-y-3">
        {conflicts.map((c) => (
          <div key={c.field}>
            <dt className="text-body-sm font-semibold">{fieldName(c.field, t)}</dt>
            <dd className="mt-1 grid gap-2 text-body-sm sm:grid-cols-2">
              <Side who={c.by ?? t["notices.someone"]} text={valueWords(c.field, c.value, t)} />
              <Side who={t["notices.conflict.you"]} text={valueWords(c.field, mine(c.field), t)} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Side({ who, text }: { who: string; text: string }) {
  return (
    <div className="border border-rule bg-paper px-2 py-1">
      <p className="font-semibold">{who}</p>
      <p className="break-words whitespace-pre-wrap">{text}</p>
    </div>
  );
}
