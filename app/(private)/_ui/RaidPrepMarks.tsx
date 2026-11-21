"use client";

// Raid prep (issue 474, D137): the Raid Shield roll call with two marks per member, Shield and Squads off
// the wall. Above the rows, the tracker's reads ("Friday's read: 87 of 98 with a shield seen") and "Accept
// the tracker's", which marks ✓ Shield up for those the tracker saw with a shield and nobody marked yet.
// Everything else is the roll call's own: the grid of tiles with "Marked (n)" for those with both marks
// set (RollCallGrid.tsx), tiles keep their order, "the rest" is "no problem seen" for the Shield, away
// members are apart (RollCallMarks.tsx). Not set never counts (D75). After each reading the tick marks ✓
// for those seen with a shield, as the tracker's (D137, 2026-11-21): the notice above the rows asks an
// officer to check them, and "Checked" or a tap on the row checks them.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { track } from "@/lib/analytics/events";
import { chip } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";
import { fold } from "@/lib/private/members-list";
import type { Occasion } from "@/lib/private/roll-call";

import { AwaySheet, type AwayWho } from "./AwaySheet";
import { useFreshOnReturn } from "./CalendarAgenda";
import type { PrepHeadView, PrepRowView } from "./prep-data";
import { RaidPrepRow } from "./RaidPrepRow";
import { sendRoll } from "./roll-call-client";
import type { MarkRowView, MarkWords, RollSheetWords } from "./roll-call-data";
import { RollGrid, useGrid } from "./RollCallGrid";
import { AwayGroup, Intro, SearchBar, useOrder } from "./RollCallMarks";
import { RestBar, useRest } from "./RollCallRest";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";
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
 * The order the page opens with (D103: never moved by a tap): the tracker's morning ✗ first, the members to
 * remind before KvK (D137, 2026-11-21); then not set, the tracker's hints first (not seen yet, then no
 * reading, then seen); then the rest marked.
 */
const keyOf = (row: MarkRowView, p: PrepRowView | undefined) =>
  row.mark === "no" && p?.fromTracker ? -1 : (row.mark === null ? 0 : 10) + (p?.rank ?? 2);
const ordered = (rows: MarkRowView[], prep: Record<number, PrepRowView>) =>
  rows
    .map((row, i) => ({ row, i, key: keyOf(row, prep[row.uid]) }))
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
}

/** The Shield ✓ is still the tick's: nobody wrote the member's Shield mark since the page was read. */
const byTracker = (m: Marks, row: MarkRowView, p: TileProps) =>
  !!p.prep[row.uid]?.fromTracker && m.shown(row.uid).version === row.version;

/**
 * The tick's ✓ marks nobody has checked yet (D137, 2026-11-21): an officer's tap on the row, either part,
 * checks it.
 */
const toCheck = (rows: MarkRowView[], m: Marks, w: Marks, p: TileProps) =>
  rows.filter(
    (row) =>
      byTracker(m, row, p) &&
      p.prep[row.uid]?.fromTracker?.unchecked &&
      w.shown(row.uid).version === (p.prep[row.uid]?.wall.version ?? 0),
  ).length;

/** "n marks came from the tracker's reading at 23:31 ST. …" and "Checked". */
function TrackerCheck(props: {
  n: number;
  head: PrepHeadView;
  words: RollSheetWords;
  slug: string;
  occasion: Occasion;
}) {
  const { head, words } = props;
  const router = useRouter();
  // The time it checked up to: a later fill's newer marks bring the notice back on an open page.
  const [done, setDone] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  if (props.n === 0 || !head.check || done === head.check.at) return null;
  const { st, at } = head.check;
  const checked = async () => {
    setBusy(true);
    const body = { action: "check", occasion: props.occasion, seen: at };
    const { status } = await sendRoll(props.slug, body);
    setBusy(false);
    if (status !== 200) return setFailed(status === 401 ? SIGNED_OUT : words["roll.failed"]);
    setDone(at);
    router.refresh();
  };
  const text = props.n === 1 ? words["roll.prep.check.one"] : words["roll.prep.check"];
  return (
    <section role="status" className="drawn-card mt-3 px-3 py-2">
      <p className="text-body-sm font-semibold">{fill(text, { n: props.n, time: st })}</p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void checked()}
        className={`${chip()} mt-2`}
      >
        {words["roll.prep.checked"]}
      </button>
      {failed && <RefusalLine text={failed} className="mt-2 text-seal" />}
    </section>
  );
}

/** One member's tile with both parts' marks (`m` the Shield's, `w` the wall's). */
const tileOf = (m: Marks, w: Marks, p: TileProps) =>
  function PrepTile(row: MarkRowView) {
    const tracker = byTracker(m, row, p);
    return (
      <RaidPrepRow
        key={row.uid}
        row={row}
        prep={p.prep[row.uid]}
        shield={m.shown(row.uid).mark}
        wall={w.shown(row.uid).mark}
        fromTracker={tracker}
        note={m.notes[row.uid] || w.notes[row.uid]}
        when={p.head.when}
        words={p.words}
        marks={p.marks}
        // A tap on the tracker's mark makes the tapped one the officer's own, never a clear (D137, 2026-11-21).
        onShield={(v) => m.tap(row.uid, v, tracker)}
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
      <TrackerCheck
        n={toCheck(asked, m, w, props)}
        head={props.head}
        words={words}
        slug={props.slug}
        occasion={props.occasion}
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
