"use client";

// Raid prep (issue 474, D137): the Raid Shield roll call with two marks per member, Shield and Squads off
// the wall. Above the rows, the tracker's reads ("Friday's read: 87 of 98 with a shield seen") and "Accept
// the tracker's", which marks ✓ Shield up for those the tracker saw with a shield and nobody marked yet.
// Everything else is the roll call's own: the grid of tiles with "Marked (n)" for those with both marks
// set (RollCallGrid.tsx), tiles keep their order, "the rest" is "no problem seen" for the Shield, away
// members are apart (RollCallMarks.tsx). Not set never counts (D75).
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { chip } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";
import { fold } from "@/lib/private/members-list";
import type { Occasion } from "@/lib/private/roll-call";

import { AwaySheet, type AwayWho } from "./AwaySheet";
import type { CalendarSheetWords } from "./calendar-data";
import { useFreshOnReturn } from "./CalendarAgenda";
import type { PrepHeadView, PrepRowView } from "./prep-data";
import { RaidPrepRow } from "./RaidPrepRow";
import type { MarkRowView, MarkWords, RollSheetWords } from "./roll-call-data";
import { RollGrid, useGrid } from "./RollCallGrid";
import { AwayGroup, Intro, SearchBar, useOrder } from "./RollCallMarks";
import { RestBar, useRest } from "./RollCallRest";
import { RefusalLine } from "./SignedOut";
import { useMarks } from "./use-marks";

function TrackerBar(props: {
  head: PrepHeadView;
  notSet: MarkRowView[];
  words: RollSheetWords;
  m: ReturnType<typeof useMarks>;
}) {
  const { head, words } = props;
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (head.lines.length === 0) return null;
  const seen = new Set(head.seen);
  const acceptable = props.notSet.filter((row) => seen.has(row.uid)).map((row) => row.uid);
  const accept = async () => {
    setBusy(true);
    const written = await props.m.bulk({ action: "accept", uids: acceptable });
    setBusy(false);
    if (!written) return;
    track("ws_roll_call_marked", { how: "tracker" });
    setDone(fill(words["roll.prep.accepted"], { n: written.length }));
  };
  return (
    <section aria-label={words["roll.prep.shield"]} className="drawn-card mt-3 px-3 py-2">
      {head.lines.map((line) => (
        <p key={line} className="text-body-sm tabular-nums">
          {line}
        </p>
      ))}
      {acceptable.length > 0 && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void accept()}
          className={`${chip()} mt-2`}
        >
          {fill(words["roll.prep.accept"], { n: acceptable.length })}
        </button>
      )}
      {done && (
        <p role="status" className="text-body-sm font-semibold text-plum">
          {done}
        </p>
      )}
    </section>
  );
}

const WALL = { part: "wall" };

/** The tracker card's two explanations, under "How this works" (issue 412 persona review). */
const trackerNotes = (head: PrepHeadView, words: RollSheetWords) =>
  head.lines.length === 0 ? [] : [...(head.hint ? [head.hint] : []), words["roll.prep.acceptHelp"]];

/**
 * The order the page opens with (D103: not set first, never moved by a tap): among the not-set rows, the
 * tracker's hints first (not seen yet, then may end before KvK, then no reading, then seen).
 */
const ordered = (rows: MarkRowView[], prep: Record<number, PrepRowView>) =>
  rows
    .map((row, i) => ({ row, i, key: (row.mark === null ? 0 : 10) + (prep[row.uid]?.rank ?? 2) }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map((x) => x.row);

/** The marks of the squads-off-the-wall part, as the rows' versions for useMarks. */
const wallRowsOf = (rows: MarkRowView[], prep: Record<number, PrepRowView>) =>
  rows.map((r) => ({
    uid: r.uid,
    mark: prep[r.uid]?.wall.mark ?? null,
    version: prep[r.uid]?.wall.version ?? 0,
  }));

type Marks = ReturnType<typeof useMarks>;
interface TileProps {
  prep: Record<number, PrepRowView>;
  head: PrepHeadView;
  words: RollSheetWords;
  marks: MarkWords;
  times: CalendarSheetWords;
}

/** One member's tile with both parts' marks (`m` the Shield's, `w` the wall's). */
const tileOf = (m: Marks, w: Marks, p: TileProps) =>
  function PrepTile(row: MarkRowView) {
    return (
      <RaidPrepRow
        key={row.uid}
        row={row}
        prep={p.prep[row.uid]}
        shield={m.shown(row.uid).mark}
        wall={w.shown(row.uid).mark}
        note={m.notes[row.uid] || w.notes[row.uid]}
        when={p.head.when}
        words={p.words}
        marks={p.marks}
        times={p.times}
        onShield={(v) => m.tap(row.uid, v)}
        onWall={(v) => w.tap(row.uid, v)}
      />
    );
  };

export function RaidPrepMarks(
  props: TileProps & {
    slug: string;
    occasion: Occasion;
    rows: MarkRowView[];
    language: string;
    today: string;
  },
) {
  const { words, marks, prep } = props;
  useFreshOnReturn();
  const failed = words["roll.failed"];
  const m = useMarks(props.slug, props.occasion, props.rows, failed);
  const w = useMarks(props.slug, props.occasion, wallRowsOf(props.rows, prep), failed, WALL);
  const r = useRest(m, marks, words);
  const all = useOrder(ordered(props.rows, prep));
  const [q, setQ] = useState("");
  const [away, setAway] = useState<AwayWho | null>(null);
  const asked = all.filter((row) => row.away === null);
  const awayRows = all.filter((row) => row.away !== null);
  const notSet = asked.filter((row) => m.shown(row.uid).mark === null);
  // "No problem seen" is never given to someone the tracker did not see with a shield (D137).
  const rest = notSet.filter((row) => prep[row.uid]?.tracker?.on !== false);
  const g = useGrid(asked, (uid) => [m.shown(uid).mark, w.shown(uid).mark]);
  const needle = fold(q.trim());
  const found = needle === "" ? null : (row: MarkRowView) => fold(row.name).includes(needle);
  const error = m.error ?? w.error;
  return (
    <>
      <Intro
        marked={asked.length - notSet.length}
        total={asked.length}
        words={words}
        marks={marks}
        shield
        undo={r.undoable && !r.fresh ? () => void r.undo() : null}
        more={trackerNotes(props.head, words)}
      />
      <TrackerBar head={props.head} notSet={notSet} words={words} m={m} />
      <SearchBar q={q} words={words} onQ={setQ} onAway={() => setAway("pick")} />
      {found && !asked.some(found) && (
        <p className="py-3">{fill(words["roll.noMatch"], { q: q.trim() })}</p>
      )}
      <RollGrid g={g} found={found} cols="two" words={words} tile={tileOf(m, w, props)} />
      {error && <RefusalLine text={error} className="mt-2 text-seal" />}
      <AwayGroup rows={awayRows} words={words} onOpen={setAway} />
      <RestBar
        left={notSet.length}
        rest={rest.length}
        part={words["roll.prep.shield"]}
        away={awayRows.length}
        words={words}
        marks={marks}
        r={r}
        onRest={() => void r.rest(rest.map((row) => row.uid))}
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
