"use client";

// Raid prep (issue 474, D137): the Raid Shield roll call with two marks per member, Shield and Squads off
// the wall. Above the rows, the answer first ("Shields for this raid: 86 of 97 seen at the morning check
// (10:04 ST)") and the Shield marks' counts that add up (issue 585, first glance), the Discord summary's state, and "Mark ✓ the n seen with a shield", which marks ✓ Shield up for
// those the tracker saw with a shield and nobody marked yet. Then "Copy n names" and "Copy one message" for
// the members whose Shield is not set or ✗, to paste into Discord, and the switch that shows the optional
// Squads off the wall pair on every tile (issue 585). "Show the n ›" beside "Mark ✓ the n" and "To remind: n"
// puts exactly those members in the grid, from the same list as the count (drilldown, 2026-11-22). Everything else is the roll call's own: the grid of
// tiles counted by the Shield only, as "n of m marked" is (issue 585), with "Marked (n)" (RollCallGrid.tsx),
// tiles keep their order, "the rest" is "no problem seen" for the Shield, away members are apart
// (RollCallMarks.tsx). Not set never counts (D75). After each reading the tick marks the Shield as the
// tracker's (D137, 2026-11-21): the notice above the rows asks an officer to check them, and "Checked" or a
// tap on the row checks them.
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { track, type RaidPrepSet, type RollCallSet } from "@/lib/analytics/events";
import { chip } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";
import { fold } from "@/lib/private/members-list";
import type { Occasion } from "@/lib/private/roll-call";

import { AwaySheet, type AwayWho } from "./AwaySheet";
import { useFreshOnReturn } from "./CalendarAgenda";
import { prepOpened } from "./drilldown-event";
import type { PrepHeadView, PrepRowView } from "./prep-data";
import { toAccept, toRemind } from "./prep-message";
import { prepNotes, RemindBar, TrackerBar, type ShowSet } from "./RaidPrepHead";
import { RaidPrepRow } from "./RaidPrepRow";
import { sendRoll } from "./roll-call-client";
import type { MarkRowView, MarkWords, RollSheetWords } from "./roll-call-data";
import type { GridFilter } from "./roll-call-grid";
import { RollGrid, useGrid } from "./RollCallGrid";
import { AwayGroup, Intro, SearchBar, useOrder } from "./RollCallMarks";
import { RestBar, useRest } from "./RollCallRest";
import { RefusalLine, SIGNED_OUT } from "./SignedOut";
import { useMarks } from "./use-marks";

const WALL = { part: "wall" };

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
const tileOf = (m: Marks, w: Marks, p: TileProps & { showWall: boolean }) =>
  function PrepTile(row: MarkRowView) {
    const tracker = byTracker(m, row, p);
    return (
      <RaidPrepRow
        key={row.uid}
        row={row}
        prep={p.prep[row.uid]}
        shield={m.shown(row.uid).mark}
        wall={w.shown(row.uid).mark}
        showWall={p.showWall}
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

type PageProps = TileProps & {
  slug: string;
  occasion: Occasion;
  rows: MarkRowView[];
  language: string;
  today: string;
  /** The chip the page opens on (`?filter=`), and the one a Roll call card's count opened it on, if any. */
  filter: GridFilter;
  opened: RollCallSet | null;
};

/**
 * "Show the n ›" puts its set in the grid and counts `ws_drilldown_opened` (PR 691): once per kind per page
 * view, with the set's size as a bucket.
 */
function useShow(g: { show: (rows: readonly MarkRowView[], label: string) => void }): ShowSet {
  const counted = useRef(new Set<RaidPrepSet>());
  return (rows, label, kind) => {
    g.show(rows, label);
    if (counted.current.has(kind)) return;
    counted.current.add(kind);
    track("ws_drilldown_opened", prepOpened(kind, rows.length));
  };
}

/** Both parts' marks, "the rest", the order, and who is asked, away, not set and still to remind. */
function usePrep(props: PageProps) {
  const { words, marks, prep } = props;
  const failed = words["roll.failed"];
  const page = { failed, roll_call: "raid_prep" } as const;
  const m = useMarks(props.slug, props.occasion, props.rows, page);
  const w = useMarks(props.slug, props.occasion, wallRowsOf(props.rows, prep), page, WALL);
  const r = useRest(m, marks, words);
  const all = useOrder(ordered(props.rows, prep));
  const asked = all.filter((row) => row.away === null);
  const notSet = asked.filter((row) => m.shown(row.uid).mark === null);
  // "No problem seen" is never given to someone the tracker did not see with a shield (D137).
  const rest = notSet.filter((row) => prep[row.uid]?.tracker?.on !== false);
  const seen = new Set(props.head.seen);
  // The chips count the Shield only, as "n of m marked" does: the wall part is optional (issue 585).
  const g = useGrid(asked, (uid) => m.shown(uid).mark, props.filter, props.opened);
  return {
    g,
    show: useShow(g),
    accept: toAccept(notSet, props.head.seen),
    m,
    w,
    r,
    all,
    asked,
    notSet,
    awayRows: all.filter((row) => row.away !== null),
    rest,
    // "Mark ✓ the n seen with a shield" covers every one of them: one button, not two (issue 585).
    offerRest: !rest.every((row) => seen.has(row.uid)),
    // The asked rows only: away members are never reminded.
    remind: toRemind(
      asked,
      (uid) => m.shown(uid).mark,
      (uid) => prep[uid]?.tracker?.on === true,
    ),
  };
}

export function RaidPrepMarks(props: PageProps) {
  const { words, marks } = props;
  useFreshOnReturn();
  const p = usePrep(props);
  const { m, w, r, all, asked, notSet, awayRows, rest, offerRest, remind, accept, g, show } = p;
  const [q, setQ] = useState("");
  const [away, setAway] = useState<AwayWho | null>(null);
  const [showWall, setShowWall] = useState(false);
  const needle = fold(q.trim());
  const found = needle === "" ? null : (row: MarkRowView) => fold(row.name).includes(needle);
  const error = m.error ?? w.error;
  return (
    <>
      {/* The answer first; its card holds "n of m marked" while the check is on (issue 585, first glance). */}
      <TrackerBar page={props} accept={accept} counts={g.counts} m={m} onShow={show} />
      <Intro
        marked={asked.length - notSet.length}
        total={asked.length}
        progress={props.head.answer === null}
        words={words}
        marks={marks}
        shield
        undo={r.undoable && !r.fresh ? () => void r.undo() : null}
        more={prepNotes(props.head, words)}
      />
      <TrackerCheck
        n={toCheck(asked, m, w, props)}
        head={props.head}
        words={words}
        slug={props.slug}
        occasion={props.occasion}
      />
      <RemindBar
        rows={remind}
        language={props.language}
        when={props.head.when}
        wall={showWall}
        onWall={() => setShowWall((s) => !s)}
        onShow={show}
        words={words}
      />
      <SearchBar q={q} words={words} onQ={setQ} onAway={() => setAway("pick")} />
      {found && !asked.some(found) && (
        <p className="py-3">{fill(words["roll.noMatch"], { q: q.trim() })}</p>
      )}
      <RollGrid
        g={g}
        found={found}
        cols="two"
        caption={words["roll.prep.filterBy"]}
        words={words}
        tile={tileOf(m, w, { ...props, showWall })}
      />
      {error && <RefusalLine text={error} className="mt-2 text-seal" />}
      <AwayGroup rows={awayRows} words={words} onOpen={setAway} />
      <RestBar
        left={notSet.length}
        rest={rest.length}
        part={words["roll.prep.shield"]}
        away={awayRows.length}
        offer={offerRest}
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
