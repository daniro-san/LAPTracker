"use client";

// The small parts both notice screens show (issue 304): a language's counter ("512 / 1000", a soft warning
// over the game's limit, never a block), the "may be out of date" line, and what someone else saved first.
import { fill } from "@/lib/copy";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { NOTICE_LIMIT, noticeLength } from "@/lib/private/notice-rules";

import { ago, conflictValue, type Conflict } from "./notice-client";

export function Counter({ text, t }: { text: string; t: WorkspaceDictionary }) {
  const n = noticeLength(text);
  const over = n > NOTICE_LIMIT;
  return (
    <span className="flex flex-col items-end text-right">
      <span
        aria-label={fill(t["notices.chars"], { n, limit: NOTICE_LIMIT })}
        className={`text-body-sm tabular-nums ${over ? "font-semibold text-seal" : "text-ink/70"}`}
      >
        {n} / {NOTICE_LIMIT}
      </span>
      {over && (
        <span role="status" className="text-body-sm text-seal">
          {fill(t["notices.over"], { limit: NOTICE_LIMIT })}
        </span>
      )}
    </span>
  );
}

/** "May be out of date — translate again?" and what can be done about it. */
export function StaleLine({ t, children }: { t: WorkspaceDictionary; children?: React.ReactNode }) {
  return (
    <div className="mt-2 border-l-4 border-yarn pl-3">
      <p className="text-body-sm font-semibold text-yarn">{t["notices.stale"]}</p>
      {children && <div className="mt-1 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

const SMALL =
  "inline-flex min-h-11 items-center border border-rule px-3 text-body-sm font-medium disabled:opacity-50";
export const smallButton = (extra = "") => `${SMALL} ${extra}`;

export function ConflictBox({
  conflict,
  t,
  language,
  onTheirs,
  onMine,
}: {
  conflict: Conflict;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  onTheirs: () => void;
  onMine: () => void;
}) {
  return (
    <div role="alert" className="mt-2 border-l-4 border-seal bg-seal/5 px-3 py-2">
      <p className="text-body-sm font-semibold">
        {fill(t["notices.conflict"], {
          name: conflict.by ?? t["notices.someone"],
          when: ago(conflict.at, language),
        })}
      </p>
      <p className="mt-1 whitespace-pre-wrap break-words">{conflictValue(conflict, t)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={onTheirs} className={smallButton()}>
          {t["notices.conflict.theirs"]}
        </button>
        <button type="button" onClick={onMine} className={smallButton()}>
          {t["notices.conflict.mine"]}
        </button>
      </div>
    </div>
  );
}
