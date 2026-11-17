"use client";

// The Members tab's "Former members" view (D107): who an earlier roster listed and the newest does not,
// newest leavers first, with a name search (accents and case do not matter) and 25 rows at a time. Each
// row: the name, the day they were last seen, the last public might and kills, and what officers
// recorded. A row opens a sheet whose facts can still be edited, so an officer can note why they left.
import { useState } from "react";

import { Sheet } from "@/lib/brand/components/Sheet";
import { fold } from "@/lib/private/members-list";

import type { FormerRow, LifecycleWords } from "./member-lifecycle-data";
import { Facts, type EditorContext } from "./MemberCards";
import { sheetWords } from "./sheet-words";

const PAGE = 25;

function FormerSheet(props: {
  row: FormerRow;
  words: LifecycleWords;
  editor: EditorContext;
  onClose: () => void;
}) {
  const { row } = props;
  return (
    <Sheet
      labelledBy="former-sheet-title"
      onCancel={props.onClose}
      title={<span translate="no">{row.name}</span>}
      words={sheetWords(props.words)}
    >
      <p className="text-body-sm">{row.lastSeen}</p>
      <p translate="no" className="mt-1 text-body-sm tabular-nums">
        {row.numbers}
      </p>
      <Facts card={row} editor={props.editor} zoneNow={null} />
    </Sheet>
  );
}

export function FormerMembers(props: {
  rows: FormerRow[];
  words: LifecycleWords;
  editor: EditorContext;
}) {
  const { rows, words: t } = props;
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState(PAGE);
  const [open, setOpen] = useState<number | null>(null);
  const key = fold(query.trim());
  const kept = key === "" ? rows : rows.filter((r) => fold(r.name).includes(key));
  const row = rows.find((r) => r.uid === open);
  return (
    <section aria-label={t["members.view.former"]} className="mt-3">
      <p className="text-body-sm text-ink/80">{t["former.lead"]}</p>
      {rows.length === 0 ? (
        <p className="mt-4 border border-rule px-4 py-5">{t["former.none"]}</p>
      ) : (
        <>
          <div
            role="search"
            className="sticky top-0 z-[5] -mx-4 mt-3 bg-paper px-4 py-2 sm:-mx-6 sm:px-6"
          >
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 64))}
              aria-label={t["former.search"]}
              placeholder={t["former.search"]}
              className="drawn-field min-h-11 w-full px-3"
            />
          </div>
          {kept.length === 0 && <p className="mt-3">{t["former.empty"]}</p>}
          <ul>
            {kept.slice(0, depth).map((r) => (
              <li key={r.uid}>
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setOpen(r.uid)}
                  className="tint-button flex min-h-14 w-full flex-col border-t border-rule px-1 py-1.5 text-left"
                >
                  <span className="flex w-full items-baseline gap-2">
                    <span translate="no" className="min-w-0 flex-1 truncate font-semibold">
                      <bdi>{r.name}</bdi>
                    </span>
                    <span className="shrink-0 text-body-sm text-ink/80">{r.lastSeen}</span>
                  </span>
                  <span translate="no" className="text-body-sm tabular-nums">
                    {r.numbers}
                  </span>
                  {r.summary && (
                    <span className="line-clamp-2 text-body-sm text-ink/75">{r.summary}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
          {kept.length > depth && (
            <button
              type="button"
              onClick={() => setDepth(depth + PAGE)}
              className="drawn-frame-soft tint-button mt-3 flex min-h-11 w-full items-center justify-center font-semibold text-plum"
            >
              {t["former.more"]}
            </button>
          )}
        </>
      )}
      {row && (
        <FormerSheet row={row} words={t} editor={props.editor} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}
