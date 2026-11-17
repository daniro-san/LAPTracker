"use client";

// "Earlier versions" in the notice editor (issue 345, D102): every save, newest first, folded to one line
// each ("Rook · Tue, Nov 17 14:02 ST" and the fields it changed). Opened, a save shows each field's text
// beside the text it replaced, and "Restore this version" puts the whole notice as it stood then into the
// editor as a draft: changed languages get Accept and Undo, and nothing is saved until Save.
import { buttonClass } from "@/lib/brand/components/Button";
import { fill } from "@/lib/copy";
import { before, fieldsAt } from "@/lib/private/notice-history";

import { fieldName, valueWords, type HistoryItem } from "./notice-client";
import type { Editor, EditorProps } from "./notice-editor-state";

function Text({ label, text, muted }: { label: string; text: string; muted?: boolean }) {
  return (
    <div className="border border-rule bg-paper px-2 py-1">
      <p className="text-body-sm font-semibold">{label}</p>
      <p className={`break-words whitespace-pre-wrap ${muted ? "text-ink/70" : ""}`}>{text}</p>
    </div>
  );
}

function Change({
  p,
  items,
  index,
  change,
}: {
  p: EditorProps;
  items: HistoryItem[];
  index: number;
  change: HistoryItem["changes"][number];
}) {
  const { t } = p;
  const { field, value } = change;
  const was = before(items, index, field);
  return (
    <div>
      <p className="text-body-sm font-semibold">{fieldName(field, t)}</p>
      {was === value ? (
        <p className="text-body-sm text-ink/70">{t["notices.history.same"]}</p>
      ) : (
        <div className="mt-1 grid gap-2 text-body-sm sm:grid-cols-2">
          {was === null ? (
            <p className="text-ink/70">{t["notices.history.first"]}</p>
          ) : (
            <Text label={t["notices.history.before"]} text={valueWords(field, was, t)} muted />
          )}
          <Text label={t["notices.history.after"]} text={valueWords(field, value, t)} />
        </div>
      )}
    </div>
  );
}

export function NoticeHistory({ p, e }: { p: EditorProps; e: Editor }) {
  const { t } = p;
  const items = p.history ?? [];
  if (items.length === 0) return null;
  return (
    <details className="mt-6 border-t border-rule pt-2">
      <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-plum">
        {fill(t["notices.history"], { n: items.length })}
        <span aria-hidden="true">&nbsp;▾</span>
      </summary>
      <ol className="mt-1">
        {items.map((item, index) => (
          <li key={item.id} className="border-t border-rule">
            <details>
              <summary className="flex min-h-11 cursor-pointer items-center gap-2 py-1">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-body-sm font-semibold">{item.line}</span>
                  <span className="text-body-sm text-ink/70">
                    {index === 0 && `${t["notices.history.current"]} · `}
                    {item.changes.map((c) => fieldName(c.field, t)).join(", ")}
                  </span>
                </span>
                <span aria-hidden="true" className="shrink-0 text-plum">
                  ▾
                </span>
              </summary>
              <div className="space-y-3 pb-3">
                {item.changes.map((change) => (
                  <Change key={change.field} p={p} items={items} index={index} change={change} />
                ))}
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      e.restoreVersion(fieldsAt(items, index));
                      document.getElementById("notice-title")?.scrollIntoView({ block: "center" });
                    }}
                    className={buttonClass("secondary")}
                  >
                    {t["notices.history.restore"]}
                  </button>
                )}
              </div>
            </details>
          </li>
        ))}
      </ol>
      {p.historyCut !== undefined && (
        <p className="text-body-sm text-ink/70">
          {fill(t["notices.history.more"], { n: p.historyCut })}
        </p>
      )}
    </details>
  );
}
