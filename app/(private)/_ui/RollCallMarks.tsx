"use client";

// One roll call (issue 298): a grid of member tiles (issue 412, RollCallGrid.tsx), each with its name, its
// mark in words and a ✓ / ✗ pair 44 px tall; the same button again clears. Tiles keep the order the page
// opened with and those already marked fold under "Marked (n)", so nothing moves under the thumb. Not set
// is where everyone starts and is counted only as "not set" (D75). Away members are listed apart and never asked.
// The bar at the bottom fills "the rest" with the kind's own answer (RollCallRest.tsx). "Add away dates"
// sets a member's away dates (D80, D103).
import { useState } from "react";

import type { RollCallSet } from "@/lib/analytics/events";
import { chip, FIELD } from "@/lib/brand/components/controls";
import { Tag } from "@/lib/brand/components/Tag";
import { isolate } from "@/lib/copy";
import { fold } from "@/lib/private/members-list";
import type { Occasion } from "@/lib/private/roll-call";
import type { Mark } from "@/lib/private/roll-call-rules";
import { fill } from "@/lib/words";

import { AwaySheet, type AwayWho } from "./AwaySheet";
import { useFreshOnReturn } from "./CalendarAgenda";
import type { MarkRowView, MarkWords, RollSheetWords } from "./roll-call-data";
import type { GridFilter } from "./roll-call-grid";
import { RollGrid, tileClass, useGrid } from "./RollCallGrid";
import { RestBar, useRest } from "./RollCallRest";
import { RefusalLine } from "./SignedOut";
import { useMarks, type Shown } from "./use-marks";

function MarkTile(props: {
  row: MarkRowView;
  shown: Shown;
  note: string | undefined;
  words: RollSheetWords;
  marks: MarkWords;
  onTap: (uid: number, tapped: "yes" | "no") => void;
}) {
  const { row, shown, marks } = props;
  return (
    <li className={tileClass(shown.mark !== null)}>
      <p translate="no" className="truncate font-semibold">
        <bdi>{row.name}</bdi>
      </p>
      <MarkLine mark={shown.mark} words={marks} notSet={props.words["roll.notSet"]} />
      {props.note && <p className="text-body-sm font-semibold text-yarn">{props.note}</p>}
      <div className="mt-1 grid grid-cols-2 gap-2">
        {(["yes", "no"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={shown.mark === v}
            aria-label={fill(props.words["roll.button"], {
              word: marks[v],
              name: isolate(row.name),
            })}
            onClick={() => props.onTap(row.uid, v)}
            className={`${chip(shown.mark === v)} min-h-11 justify-center text-[22px]`}
          >
            <span aria-hidden="true">{v === "yes" ? "✓" : "✗"}</span>
          </button>
        ))}
      </div>
    </li>
  );
}

/** The mark in words under the name, "Not set" while there is none, so a tile keeps its height. */
export function MarkLine(props: {
  mark: Mark | null;
  words: { yes: string; no: string; assumed?: string };
  notSet: string;
}) {
  const said = props.mark ? props.words[props.mark] : undefined;
  return (
    <p className="truncate leading-5">
      {said ? (
        <Tag tone={props.mark === "yes" ? "progress" : "neutral"}>{said}</Tag>
      ) : (
        <span className="text-label text-ink/75">{props.notSet}</span>
      )}
    </p>
  );
}

export function AwayGroup(props: {
  rows: MarkRowView[];
  words: RollSheetWords;
  onOpen: (row: MarkRowView) => void;
}) {
  const { words } = props;
  if (props.rows.length === 0) return null;
  return (
    <section aria-labelledby="rc-away" className="mt-6">
      <h2 id="rc-away" className="font-subhead text-display-sm">
        {`${words["roll.awayHead"]} · ${props.rows.length}`}
      </h2>
      <ul className="mt-1">
        {props.rows.map((r) => (
          <li key={r.uid} className="flex items-center gap-2 border-t border-rule py-1">
            <div className="min-w-0 flex-1">
              <p translate="no" className="truncate font-semibold">
                <bdi>{r.name}</bdi>
              </p>
              <p className="text-body-sm text-ink/75">{r.away}</p>
            </div>
            <button type="button" onClick={() => props.onOpen(r)} className={chip()}>
              {words["roll.away.change"]}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Above the tiles: "2 of 58 marked" (with "All marked" and "Undo the rest" beside it), then the ✓ / ✗
 * words and "Tap ✓ or ✗. Tap again to clear." as the summary of "How this works", which holds why not set
 * never counts, how tiles are ordered and the page's own `more` lines (Raid prep's tracker notes), so a
 * phone's first screen reaches the tiles (issue 412 persona review).
 */
export function Intro(props: {
  marked: number;
  total: number;
  words: RollSheetWords;
  marks: MarkWords;
  shield: boolean;
  undo: (() => void) | null;
  more?: string[];
  /** False when the page says "n of m marked" elsewhere (Raid prep's answer card, issue 585). */
  progress?: boolean;
}) {
  const { words, marks } = props;
  const progress = props.progress !== false;
  return (
    <>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 text-body-sm">
        {progress && (
          <span>{fill(words["roll.progress"], { n: props.marked, total: props.total })}</span>
        )}
        {progress && props.total > 0 && props.marked === props.total && (
          <span className="font-semibold">{words["roll.done"]}</span>
        )}
        {props.undo && (
          <button type="button" onClick={props.undo} className={chip()}>
            {words["roll.undoRest"]}
          </button>
        )}
      </p>
      <details className="text-body-sm text-ink/80">
        <summary className="flex min-h-11 cursor-pointer items-center">
          <span>
            {`✓ ${marks.yes} · ✗ ${marks.no}. ${words["roll.legend"]} `}
            <span className="font-semibold whitespace-nowrap text-plum underline underline-offset-4">
              {words["roll.how"]}
            </span>
          </span>
        </summary>
        <div className="space-y-1 pb-2">
          <p>{words["roll.how.notSet"]}</p>
          <p>{words["roll.order"]}</p>
          {props.shield && <p>{words["roll.legend.shield"]}</p>}
          {props.more?.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </details>
    </>
  );
}

export function SearchBar(props: {
  q: string;
  words: RollSheetWords;
  onQ: (q: string) => void;
  onAway: () => void;
}) {
  const { words } = props;
  return (
    // `data-sticky-search` gives the page its scroll-padding-top (globals.css, issue 585).
    <div data-sticky-search className="sticky top-0 z-[5] mt-2 flex items-end gap-2 bg-paper py-2">
      {/* A label that stays on screen, not a placeholder (issue 585). */}
      <label className="min-w-0 flex-1">
        <span className="block text-body-sm font-semibold">{words["roll.search"]}</span>
        <input
          type="search"
          autoComplete="off"
          value={props.q}
          onChange={(e) => props.onQ(e.target.value)}
          className={FIELD}
        />
      </label>
      <button type="button" onClick={props.onAway} className={`${chip()} shrink-0`}>
        {words["roll.away.open"]}
      </button>
    </div>
  );
}

/** The rows in the order the page opened with; members new to this read go after them. */
export function useOrder(rows: MarkRowView[]) {
  const [order] = useState(() => rows.map((r) => r.uid));
  const byUid = new Map(rows.map((r) => [r.uid, r]));
  return [...order, ...rows.map((r) => r.uid).filter((u) => !order.includes(u))]
    .map((u) => byUid.get(u))
    .filter((r): r is MarkRowView => r !== undefined);
}

interface RollCallMarksProps {
  slug: string;
  occasion: Occasion;
  rows: MarkRowView[];
  words: RollSheetWords;
  marks: MarkWords;
  shield: boolean;
  language: string;
  /** Today's server day, the first day an away note gets when none is picked (D103). */
  today: string;
  /** The chip the page opens on (`?filter=`), and the one a Roll call card's count opened it on, if any. */
  filter: GridFilter;
  opened: RollCallSet | null;
}

export function RollCallMarks(props: RollCallMarksProps) {
  const { words, marks } = props;
  useFreshOnReturn();
  const page = { failed: words["roll.failed"], roll_call: "other" } as const;
  const m = useMarks(props.slug, props.occasion, props.rows, page);
  const r = useRest(m, marks, words);
  const all = useOrder(props.rows);
  const [q, setQ] = useState("");
  const [away, setAway] = useState<AwayWho | null>(null);
  const asked = all.filter((row) => row.away === null);
  const awayRows = all.filter((row) => row.away !== null);
  const notSet = asked.filter((row) => m.shown(row.uid).mark === null);
  const g = useGrid(asked, (uid) => m.shown(uid).mark, props.filter, props.opened);
  const needle = fold(q.trim());
  const found = needle === "" ? null : (row: MarkRowView) => fold(row.name).includes(needle);
  return (
    <>
      <Intro
        marked={asked.length - notSet.length}
        total={asked.length}
        words={words}
        marks={marks}
        shield={props.shield}
        undo={r.undoable && !r.fresh ? () => void r.undo() : null}
      />
      <SearchBar q={q} words={words} onQ={setQ} onAway={() => setAway("pick")} />
      {found && !asked.some(found) && (
        <p className="py-3">{fill(words["roll.noMatch"], { q: q.trim() })}</p>
      )}
      <RollGrid
        g={g}
        found={found}
        cols="one"
        words={words}
        said={marks}
        tile={(row) => (
          <MarkTile
            key={row.uid}
            row={row}
            shown={m.shown(row.uid)}
            note={m.notes[row.uid]}
            words={words}
            marks={marks}
            onTap={m.tap}
          />
        )}
      />
      {m.error && <RefusalLine text={m.error} className="mt-2 text-seal" />}
      <AwayGroup rows={awayRows} words={words} onOpen={setAway} />
      <RestBar
        left={notSet.length}
        away={awayRows.length}
        words={words}
        marks={marks}
        r={r}
        onRest={() => void r.rest(notSet.map((row) => row.uid))}
      />
      {away && (
        <AwaySheet
          slug={props.slug}
          who={away}
          rows={all}
          words={words}
          language={props.language}
          today={props.today}
          onClose={() => setAway(null)}
        />
      )}
    </>
  );
}
