"use client";

// "The rest" on a roll call (issue 298, D103): the sticky bar above the tabs and its state. The bar says
// how many are not set and how many are away, and its button names the count and the kind's default
// ("Mark the other 57 as took part"); with nothing left it says only "All marked". After the tap it reads
// "57 marked as took part · Undo" for about 10 s; "Undo the rest" stays by the counts while any of those
// marks is unchanged. Plunders have no "the rest" (owner, 2026-11-17): the bar keeps only its count.
import { useRef, useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";

import type { MarkWords, RollSheetWords } from "./roll-call-data";
import type { useMarks } from "./use-marks";

type Item = { uid: number; version: number };
const SHOWN_MS = 10_000;

/** "The rest", its undo, the line the bar shows for a while after it, and whether undo still applies. */
export function useRest(m: ReturnType<typeof useMarks>, marks: MarkWords, words: RollSheetWords) {
  const [last, setLast] = useState<{ items: Item[]; text: string } | null>(null);
  const [fresh, setFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (text: string, items: Item[]) => {
    setLast({ items, text });
    setFresh(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setFresh(false), SHOWN_MS);
  };
  const rest = async (uids: number[]) => {
    if (!marks.rest) return;
    setBusy(true);
    const written = await m.rest(uids);
    setBusy(false);
    if (written) show(fill(marks.rest.done, { n: written.length }), written);
  };
  const undo = async () => {
    if (!last) return;
    setBusy(true);
    const done = await m.undo(last.items);
    setBusy(false);
    if (done) show(words["roll.undone"], []);
  };
  const undoable = last !== null && last.items.some((i) => m.shown(i.uid).version === i.version);
  return { text: last?.text ?? null, fresh, busy, undoable, rest, undo };
}

/**
 * The sticky bar: above the bottom tabs below 768, at the window's foot from 768, where the tabs are a rail
 * (D122; until then it floated 60 px up the list, issue 412 UX pass). It spans the content's width on solid
 * paper with a 2 px ink rule on top, so the rows that pass under it end at a clear edge.
 */
export function RestBar(props: {
  left: number;
  /** D137: how many "the rest" marks, when fewer than `left` (Raid prep leaves out the not-seen). */
  rest?: number;
  away: number;
  words: RollSheetWords;
  marks: MarkWords;
  r: ReturnType<typeof useRest>;
  onRest: () => void;
}) {
  const { words, marks, r, left } = props;
  const rest = props.rest ?? left;
  const count =
    props.away > 0
      ? fill(words["roll.leftAway"], { n: left, away: props.away })
      : fill(words["roll.left"], { n: left });
  return (
    <div className="sticky bottom-[calc(3.5rem+4px+env(safe-area-inset-bottom))] z-10 -mx-4 mt-4 border-t-2 border-ink bg-paper px-4 py-2 sm:-mx-6 sm:px-6 md:bottom-0 md:pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {r.fresh && r.text ? (
        <p role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{r.text}</span>
          {r.undoable && (
            <button
              type="button"
              disabled={r.busy}
              onClick={() => void r.undo()}
              className={chip()}
            >
              {words["roll.undo"]}
            </button>
          )}
        </p>
      ) : left === 0 ? (
        <p className="flex min-h-11 items-center text-ink/80">{words["roll.done"]}</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p className="min-w-0 text-body-sm tabular-nums sm:flex-1">{count}</p>
          {marks.rest && rest > 0 && (
            <button
              type="button"
              disabled={r.busy}
              onClick={props.onRest}
              className={buttonClass("secondary", "w-full sm:w-auto")}
            >
              {fill(marks.rest.button, { n: rest })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
