"use client";

// The roll call as a grid (issue 412, rollout PR 5; D103 amended): filter chips (To mark · ✓ · ✗ · All,
// each with its count), the members' tiles, and under "To mark" the members already marked, collapsed into
// "Marked (n)", opened 40 at a time. The sections are taken when the page opens and when a chip is tapped
// (roll-call-grid.ts), never by a mark, so a tile stays where it is while the officer marks. A search
// looks through every member. Every roll call kind uses it; Raid prep's chips count the Shield only (D137).
// It opens on the chip the address names (`?filter=`, else "To mark"), and `show` puts exactly one set of
// members in it, with its line ("The 21 to remind"), until a chip is tapped. A page a card's count opened
// counts `ws_drilldown_opened` once per page view (PR 691).
import { useEffect, useRef, useState, type ReactNode } from "react";

import { track, type RollCallSet } from "@/lib/analytics/events";
import { chip } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";

import { rollCallOpened } from "./drilldown-event";
import type { RollSheetWords } from "./roll-call-data";
import {
  gridCounts,
  MARKED_PAGE,
  sections,
  takeSet,
  takeSnap,
  type GridFilter,
  type MarkOf,
} from "./roll-call-grid";

/**
 * Tiles for one mark: two across at 360, three from 640, four from 1024. Raid prep's wider tiles: one,
 * two from 640, three from 1024, four from 1280 on the wide frame (issue 585).
 */
const COLS = {
  one: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  two: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

/** A member's tile: a hairline box, tinted once every part is marked, so the done ones read at a glance. */
export function tileClass(done: boolean) {
  return `min-w-0 border border-rule px-2 pt-1.5 pb-2 ${done ? "bg-ink/[0.04]" : ""}`;
}

/** A card's count opened this page on its chip (`opened`): counted once, with the chip's size as a bucket. */
function useOpenedFrom(opened: RollCallSet | null, n: number) {
  const sent = useRef(false);
  useEffect(() => {
    if (!opened || sent.current) return;
    sent.current = true;
    track("ws_drilldown_opened", rollCallOpened(opened, n));
  }, [opened, n]);
}

export function useGrid<T extends { uid: number }>(
  rows: T[],
  markOf: MarkOf,
  initial: GridFilter = "todo",
  opened: RollCallSet | null = null,
) {
  const uids = rows.map((r) => r.uid);
  const [snap, setSnap] = useState(() => takeSnap(initial, uids, markOf));
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(MARKED_PAGE);
  const counts = gridCounts(uids, markOf);
  useOpenedFrom(opened, opened ? counts[opened] : 0);
  return {
    snap,
    counts,
    open,
    limit,
    /** A chip tap takes the sections again, the one already chosen too ("tap a filter to sort again"). */
    choose: (filter: GridFilter) => {
      setSnap(takeSnap(filter, uids, markOf));
      setOpen(false);
      setLimit(MARKED_PAGE);
    },
    /** Exactly these members, no chip pressed, under `label`; a chip tap goes back to the chips. */
    show: (set: readonly { uid: number }[], label: string) => {
      setSnap(
        takeSet(
          uids,
          set.map((r) => r.uid),
          label,
        ),
      );
      setOpen(false);
    },
    toggle: () => setOpen((o) => !o),
    more: () => setLimit((l) => l + MARKED_PAGE),
    sectionsOf: (found: ((row: T) => boolean) | null) => sections(rows, snap, markOf, found),
  };
}

type Grid<T extends { uid: number }> = ReturnType<typeof useGrid<T>>;

function Filters<T extends { uid: number }>(props: {
  g: Grid<T>;
  words: RollSheetWords;
  said?: { yes: string; no: string } | undefined;
}) {
  const { g, words, said } = props;
  const { counts } = g;
  const items: { f: GridFilter; text: string; label?: string }[] = [
    { f: "todo", text: `${words["roll.grid.todo"]} ${counts.todo}` },
    {
      f: "yes",
      text: `✓ ${counts.yes}`,
      label: said ? `${said.yes}: ${counts.yes}` : fill(words["roll.grid.yes"], { n: counts.yes }),
    },
    {
      f: "no",
      text: `✗ ${counts.no}`,
      label: said ? `${said.no}: ${counts.no}` : fill(words["roll.grid.no"], { n: counts.no }),
    },
    { f: "all", text: `${words["roll.grid.all"]} ${counts.all}` },
  ];
  return (
    <div
      role="group"
      aria-label={words["roll.grid.aria"]}
      className="mt-1 flex items-center gap-2 overflow-x-auto pb-1 [&>*]:shrink-0"
    >
      {items.map((it) => (
        <button
          key={it.f}
          type="button"
          aria-pressed={g.snap.filter === it.f}
          aria-label={it.label}
          onClick={() => g.choose(it.f)}
          className={`${chip(g.snap.filter === it.f)} min-w-11 justify-center tabular-nums`}
        >
          {it.text}
        </button>
      ))}
    </div>
  );
}

function Tiles<T extends { uid: number }>(props: {
  rows: T[];
  cols: keyof typeof COLS;
  tile: (row: T) => ReactNode;
}) {
  if (props.rows.length === 0) return null;
  return (
    <ul className={`mt-2 grid items-start gap-2 ${COLS[props.cols]}`}>
      {props.rows.map(props.tile)}
    </ul>
  );
}

/** "Marked (73) ▾": closed until tapped; opened, 40 at a time with "Show 40 more". */
function MarkedGroup<T extends { uid: number }>(props: {
  g: Grid<T>;
  rows: T[];
  cols: keyof typeof COLS;
  words: RollSheetWords;
  tile: (row: T) => ReactNode;
}) {
  const { g, rows, words } = props;
  if (rows.length === 0) return null;
  const left = rows.length - g.limit;
  return (
    <section className="mt-4">
      <h2>
        <button
          type="button"
          aria-expanded={g.open}
          onClick={g.toggle}
          className="flex min-h-11 w-full items-center gap-2 border-t border-rule text-left font-subhead text-display-sm"
        >
          <span className="flex-1">{fill(words["roll.grid.marked"], { n: rows.length })}</span>
          <span aria-hidden="true">{g.open ? "▴" : "▾"}</span>
        </button>
      </h2>
      {g.open && (
        <>
          <Tiles rows={rows.slice(0, g.limit)} cols={props.cols} tile={props.tile} />
          {left > 0 && (
            <button type="button" onClick={g.more} className={`${chip()} mt-2`}>
              {fill(words["roll.grid.more"], { n: Math.min(left, MARKED_PAGE) })}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/** The chips, the tiles and the "Marked" group; `found` is the search, null while it is empty. */
export function RollGrid<T extends { uid: number }>(props: {
  g: Grid<T>;
  found: ((row: T) => boolean) | null;
  cols: keyof typeof COLS;
  words: RollSheetWords;
  /** The kind's ✓ and ✗ words, the chips' spoken names; without them "49 marked ✓" (Raid prep). */
  said?: { yes: string; no: string };
  /** Which mark the chips count, above them ("Filter by Shield mark", Raid prep, issue 585). */
  caption?: string;
  tile: (row: T) => ReactNode;
}) {
  const { g, words } = props;
  const { list, marked } = g.sectionsOf(props.found);
  const empty = g.snap.filter === "todo" ? "roll.grid.none.todo" : "roll.grid.none";
  return (
    <>
      {!props.found && props.caption && (
        <p className="mt-1 text-body-sm text-ink/80">{props.caption}</p>
      )}
      {!props.found && <Filters g={g} words={words} said={props.said} />}
      {/* A shown set says which it is: no chip is pressed (drilldown panel review). */}
      {!props.found && g.snap.label && (
        <p className="mt-2 text-body-sm font-semibold">{g.snap.label}</p>
      )}
      {/* With nobody left, the tiles marked meanwhile stay; the line says why (persona review). */}
      {!props.found && (list.length === 0 || (g.snap.filter === "todo" && g.counts.todo === 0)) && (
        <p className="py-3 text-ink/80">{words[empty]}</p>
      )}
      <Tiles rows={list} cols={props.cols} tile={props.tile} />
      <MarkedGroup g={g} rows={marked} cols={props.cols} words={words} tile={props.tile} />
    </>
  );
}
