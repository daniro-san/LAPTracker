"use client";

// The Members tab's "Former members" view (D107): who an earlier roster listed and the newest does not,
// newest leavers first, with a name search (accents and case do not matter) and 25 rows at a time. Each
// row: the name, the day they were last seen, the last public might and kills, the newest week of
// Alliance Duel points saved for them, and what officers recorded. A row opens a sheet whose facts can still be edited, so an officer can note why they left.
// From 1024 the list and the open one sit side by side, the open one in the address (`?m=`), as on
// Members (D122); Up and Down step through the rows and open the one the focus lands on.
import { useState, type ReactNode } from "react";

import { MasterDetail } from "@/lib/brand/components/layout/MasterDetail";
import { Sheet } from "@/lib/brand/components/Sheet";
import { fold } from "@/lib/private/members-list";

import type { FormerRow, LifecycleWords } from "./member-lifecycle-data";
import { Facts, factsActions, type EditorContext, type FactsMode } from "./MemberCards";
import { shown, stepRow, useOpenMember } from "./open-member";
import { OPEN_ROW } from "./PendingMembers";
import { sheetWords } from "./sheet-words";

const PAGE = 25;

function FormerSheet(props: {
  row: FormerRow;
  words: LifecycleWords;
  editor: EditorContext;
  onClose: () => void;
  pane: boolean;
}) {
  const { row } = props;
  const [mode, setMode] = useState<FactsMode>(null);
  return (
    <Sheet
      pane={props.pane}
      labelledBy="former-sheet-title"
      onCancel={props.onClose}
      title={<span translate="no">{row.name}</span>}
      words={sheetWords(props.words)}
      {...factsActions(props.editor.words, setMode)}
    >
      <p className="text-body-sm">{row.lastSeen}</p>
      <p translate="no" className="mt-1 text-body-sm tabular-nums">
        {row.numbers}
      </p>
      {row.duel && (
        <p translate="no" className="mt-1 text-body-sm tabular-nums">
          {row.duel}
        </p>
      )}
      <Facts
        card={row}
        editor={props.editor}
        zoneNow={null}
        mode={mode}
        onEditorClose={() => setMode(null)}
      />
    </Sheet>
  );
}

/** One former member: name and last seen, their numbers, the duel week and what officers recorded. */
function FormerRowButton(p: {
  row: FormerRow;
  index: number;
  open: boolean;
  sheet: boolean;
  onOpen: () => void;
}) {
  const r = p.row;
  return (
    <button
      type="button"
      data-row={p.index}
      data-uid={r.uid}
      aria-haspopup={p.sheet ? "dialog" : undefined}
      aria-current={p.open ? "true" : undefined}
      onClick={p.onOpen}
      className={`${p.open ? OPEN_ROW : "tint-button"} flex min-h-14 w-full flex-col border-t border-rule px-2 py-1.5 text-left`}
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
      {r.duel && (
        <span translate="no" className="text-body-sm tabular-nums">
          {r.duel}
        </span>
      )}
      {r.summary && <span className="line-clamp-2 text-body-sm text-ink/75">{r.summary}</span>}
    </button>
  );
}

/** The lead, the name search, 25 rows at a time. */
function FormerList(p: {
  rows: FormerRow[];
  t: LifecycleWords;
  at: ReturnType<typeof useOpenMember>;
}) {
  const { rows, t, at } = p;
  const [query, setQuery] = useState("");
  const [depth, setDepth] = useState(PAGE);
  const key = fold(query.trim());
  const kept = key === "" ? rows : rows.filter((r) => fold(r.name).includes(key));
  return (
    <>
      <p className="text-body-sm text-ink/80">{t["former.lead"]}</p>
      {rows.length === 0 ? (
        <p className="drawn-card mt-4 px-4 py-5">{t["former.none"]}</p>
      ) : (
        <>
          <div
            role="search"
            className="sticky top-0 z-[5] -mx-4 mt-3 bg-paper px-4 py-2 md:-mx-6 md:px-6 lg:mx-0 lg:px-0"
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
          <ul
            onKeyDown={(e) => {
              const uid = stepRow(e);
              if (uid !== null && at.wide) at.show(uid, true);
            }}
          >
            {kept.slice(0, depth).map((r, i) => (
              <li key={r.uid}>
                <FormerRowButton
                  row={r}
                  index={i}
                  open={r.uid === at.open}
                  sheet={at.wide !== true}
                  onOpen={() => at.show(r.uid)}
                />
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
    </>
  );
}

export function FormerMembers(props: {
  rows: FormerRow[];
  words: LifecycleWords;
  editor: EditorContext;
  /** `?m=` when the page was opened. */
  initialOpen: string | null;
  /** After the list, in its column. */
  foot: ReactNode;
}) {
  const { rows, words: t } = props;
  const at = useOpenMember(props.initialOpen);
  const row = rows.find((r) => r.uid === at.open);
  const sheet = (pane: boolean) =>
    row && (
      <FormerSheet
        key={row.uid}
        pane={pane}
        row={row}
        words={t}
        editor={props.editor}
        onClose={() => {
          at.close();
          if (pane) shown(`[data-uid="${row.uid}"]`)?.focus();
        }}
      />
    );
  return (
    <section aria-label={t["members.view.former"]} className="mt-3">
      <MasterDetail
        list={
          <>
            <FormerList rows={rows} t={t} at={at} />
            {props.foot}
          </>
        }
        detail={at.wide ? (sheet(true) ?? null) : null}
        {...(row && { detailLabel: row.name })}
        empty={t["members.pick"]}
      />
      {at.wide === false && sheet(false)}
    </section>
  );
}
