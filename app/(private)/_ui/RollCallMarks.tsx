"use client";

// One roll call (issue 298): compact rows, each with a ✓ / ✗ pair 48 px tall; the same button again
// clears. Rows keep the order the page opened with, so nothing moves under the thumb. Not set is where
// everyone starts and is counted only as "not set" (D75). Away members are listed apart and never asked.
// The bar at the bottom fills "the rest" with the kind's own answer (no problem seen, did not join, took
// part), with an undo. "Someone is away" sets a member's away dates (D80).
import { useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip, FIELD } from "@/lib/brand/components/controls";
import { Tag } from "@/lib/brand/components/Tag";
import { fill } from "@/lib/copy";
import { fold } from "@/lib/private/members-list";
import type { Occasion } from "@/lib/private/roll-call";

import { AwaySheet, type AwayWho } from "./AwaySheet";
import { useFreshOnReturn } from "./CalendarAgenda";
import type { MarkRowView, MarkWords, RollSheetWords } from "./roll-call-data";
import { RefusalLine } from "./SignedOut";
import { useMarks, type Shown } from "./use-marks";

function MarkRow(props: {
  row: MarkRowView;
  shown: Shown;
  note: string | undefined;
  words: RollSheetWords;
  marks: MarkWords;
  onTap: (uid: number, tapped: "yes" | "no") => void;
}) {
  const { row, shown, marks } = props;
  return (
    <li className="flex items-center gap-2 border-t border-rule py-1">
      <div className="min-w-0 flex-1">
        <p translate="no" className="truncate font-semibold">
          <bdi>{row.name}</bdi>
        </p>
        {shown.mark && (
          <Tag tone={shown.mark === "yes" ? "progress" : "neutral"}>{marks[shown.mark]}</Tag>
        )}
        {props.note && <p className="text-body-sm font-semibold text-yarn">{props.note}</p>}
      </div>
      {(["yes", "no"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={shown.mark === v}
          aria-label={fill(props.words["roll.button"], { word: marks[v], name: row.name })}
          onClick={() => props.onTap(row.uid, v)}
          className={`${chip(shown.mark === v)} min-h-12 min-w-12 shrink-0 justify-center text-[22px]`}
        >
          <span aria-hidden="true">{v === "yes" ? "✓" : "✗"}</span>
        </button>
      ))}
    </li>
  );
}

function AwayGroup(props: {
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

type Snack = { text: string; undo: { uid: number; version: number }[] | null };

/** The bar above the tabs: how many are not set, "the rest", and the undo after it. */
function RestBar(props: {
  left: number;
  words: RollSheetWords;
  marks: MarkWords;
  snack: Snack | null;
  busy: boolean;
  onRest: () => void;
  onUndo: () => void;
}) {
  const { words, snack } = props;
  return (
    <div className="sticky bottom-[calc(3.5rem+4px+env(safe-area-inset-bottom))] z-[5] mt-4 border-t border-rule bg-paper py-2">
      {snack && (
        <p role="status" className="flex flex-wrap items-center gap-x-3 text-body-sm">
          <span>{snack.text}</span>
          {snack.undo && (
            <button type="button" onClick={props.onUndo} className={chip()}>
              {words["roll.undo"]}
            </button>
          )}
        </p>
      )}
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 text-body-sm tabular-nums">
          {props.left === 0 ? words["roll.done"] : fill(words["roll.left"], { n: props.left })}
        </span>
        <button
          type="button"
          disabled={props.left === 0 || props.busy}
          onClick={props.onRest}
          className={buttonClass("secondary", "shrink-0")}
        >
          {props.marks.rest}
        </button>
      </div>
    </div>
  );
}

/** "The rest" and its undo, with the line the bar shows after each. */
function useRest(m: ReturnType<typeof useMarks>, words: RollSheetWords, marks: MarkWords) {
  const [snack, setSnack] = useState<Snack | null>(null);
  const [busy, setBusy] = useState(false);
  const rest = async (uids: number[]) => {
    setBusy(true);
    const written = await m.rest(uids);
    setBusy(false);
    if (written) {
      const text = fill(words["roll.rest.done"], { n: written.length, word: marks.restWord });
      setSnack({ text, undo: written });
    }
  };
  const undo = async () => {
    if (!snack?.undo) return;
    setBusy(true);
    const done = await m.undo(snack.undo);
    setBusy(false);
    if (done) setSnack({ text: words["roll.undone"], undo: null });
  };
  return { snack, busy, rest, undo };
}

function Legend(props: {
  marked: number;
  total: number;
  words: RollSheetWords;
  marks: MarkWords;
  shield: boolean;
}) {
  const { words, marks } = props;
  return (
    <>
      <p className="mt-3 text-body-sm">
        {fill(words["roll.progress"], { n: props.marked, total: props.total })}
      </p>
      <p className="text-body-sm text-ink/75">
        {`✓ ${marks.yes} · ✗ ${marks.no}. ${words["roll.legend"]}`}
        {props.shield && ` ${words["roll.legend.shield"]}`}
      </p>
      <p className="text-body-sm text-ink/75">{words["roll.order"]}</p>
    </>
  );
}

function SearchBar(props: {
  q: string;
  words: RollSheetWords;
  onQ: (q: string) => void;
  onAway: () => void;
}) {
  const { words } = props;
  return (
    <div className="sticky top-0 z-[5] mt-2 flex items-end gap-2 bg-paper py-2">
      <label className="min-w-0 flex-1">
        <span className="sr-only">{words["roll.search"]}</span>
        <input
          type="search"
          autoComplete="off"
          placeholder={words["roll.search"]}
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
function useOrder(rows: MarkRowView[]) {
  const [order] = useState(() => rows.map((r) => r.uid));
  const byUid = new Map(rows.map((r) => [r.uid, r]));
  return [...order, ...rows.map((r) => r.uid).filter((u) => !order.includes(u))]
    .map((u) => byUid.get(u))
    .filter((r): r is MarkRowView => r !== undefined);
}

export function RollCallMarks(props: {
  slug: string;
  occasion: Occasion;
  rows: MarkRowView[];
  words: RollSheetWords;
  marks: MarkWords;
  shield: boolean;
  language: string;
}) {
  const { words, marks } = props;
  useFreshOnReturn();
  const m = useMarks(props.slug, props.occasion, props.rows, words["roll.failed"]);
  const r = useRest(m, words, marks);
  const all = useOrder(props.rows);
  const [q, setQ] = useState("");
  const [away, setAway] = useState<AwayWho | null>(null);
  const asked = all.filter((row) => row.away === null);
  const notSet = asked.filter((row) => m.shown(row.uid).mark === null);
  const needle = fold(q.trim());
  const found = asked.filter((row) => needle === "" || fold(row.name).includes(needle));
  return (
    <>
      <Legend
        marked={asked.length - notSet.length}
        total={asked.length}
        words={words}
        marks={marks}
        shield={props.shield}
      />
      <SearchBar q={q} words={words} onQ={setQ} onAway={() => setAway("pick")} />
      {needle !== "" && found.length === 0 && (
        <p className="py-3">{fill(words["roll.noMatch"], { q: q.trim() })}</p>
      )}
      <ul>
        {found.map((row) => (
          <MarkRow
            key={row.uid}
            row={row}
            shown={m.shown(row.uid)}
            note={m.notes[row.uid]}
            words={words}
            marks={marks}
            onTap={m.tap}
          />
        ))}
      </ul>
      {m.error && <RefusalLine text={m.error} className="mt-2 text-seal" />}
      <AwayGroup rows={all.filter((row) => row.away !== null)} words={words} onOpen={setAway} />
      <RestBar
        left={notSet.length}
        words={words}
        marks={marks}
        snack={r.snack}
        busy={r.busy}
        onRest={() => void r.rest(notSet.map((row) => row.uid))}
        onUndo={() => void r.undo()}
      />
      {away && (
        <AwaySheet
          slug={props.slug}
          who={away}
          rows={all}
          words={words}
          language={props.language}
          onClose={() => setAway(null)}
        />
      )}
    </>
  );
}
