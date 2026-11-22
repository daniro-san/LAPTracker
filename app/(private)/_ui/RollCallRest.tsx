"use client";

// "The rest" on a roll call (issue 298, D103): the sticky bar above the tabs and its state. The bar says
// how many are not set and how many are away, and its button names the count and the kind's default
// ("Mark the other 57 as took part"); with nothing left it goes, and "All marked" shows by the counts at
// the top (issue 412). After the tap it reads "57 marked as took part · Undo" for about 10 s; "Undo the
// rest" stays by the counts while any of those marks is unchanged. Plunders have no "the rest" (owner, 2026-11-17): the bar keeps only its count.
import { useRef, useState } from "react";

import { buttonClass } from "@/lib/brand/components/Button";
import { chip } from "@/lib/brand/components/controls";
import { fill } from "@/lib/words";

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

/** "57 not set · 3 away, left out"; Raid prep's "Shield: 61 to mark · 16 not seen yet, left out". */
function countLine(
  p: { left: number; rest: number; away: number; part?: string | undefined },
  words: RollSheetWords,
) {
  // One away or one not seen takes the singular: PT and FR agree the word with the count (issue 585).
  const notSeen = p.left - p.rest;
  // Raid prep (the bar names its part) counts in its card's words, "to mark" (issue 585).
  const [left, away, awayOne] = p.part
    ? (["roll.prep.left", "roll.prep.leftAway", "roll.prep.leftAway.one"] as const)
    : (["roll.left", "roll.leftAway", "roll.leftAway.one"] as const);
  const counts = [
    p.away > 0
      ? fill(words[p.away === 1 ? awayOne : away], { n: p.left, away: p.away })
      : fill(words[left], { n: p.left }),
    ...(notSeen > 0
      ? [
          fill(words[notSeen === 1 ? "roll.prep.notSeenLeft.one" : "roll.prep.notSeenLeft"], {
            n: notSeen,
          }),
        ]
      : []),
  ].join(" · ");
  return p.part ? `${p.part}: ${counts}` : counts;
}

/** The "the rest" button's words, when the bar offers it: the kind has one, someone is left, and it is wanted. */
const offered = (marks: MarkWords, rest: number, offer: boolean | undefined) =>
  marks.rest && rest > 0 && offer !== false ? marks.rest.button : null;

/**
 * The sticky bar: above the bottom tabs below 768, at the window's foot from 768, where the tabs are a rail
 * (D122; until then it floated 60 px up the list, issue 412 UX pass). It spans the content's width on solid
 * paper with a 2 px ink rule on top, so the rows that pass under it end at a clear edge. It is one line
 * (issue 585): below 640 the button alone, its counts kept for screen readers (the chips and "n of m
 * marked" above show them), from 640 the counts beside it. `data-rest-bar` gives the page its
 * scroll-padding, so a focused control never hides under the bar (globals.css).
 */
export function RestBar(props: {
  left: number;
  /** D137: how many "the rest" marks, when fewer than `left` (Raid prep leaves out the not-seen). */
  rest?: number;
  /** Raid prep: the part the counts are about ("Shield: 61 to mark · 16 not seen yet, left out"). */
  part?: string;
  away: number;
  /**
   * Raid prep (issue 585): false while "Mark ✓ the n seen with a shield" acts on the same members, so the
   * page offers one button for them; the count line stays.
   */
  offer?: boolean;
  words: RollSheetWords;
  marks: MarkWords;
  r: ReturnType<typeof useRest>;
  onRest: () => void;
}) {
  const { words, marks, r, left } = props;
  const rest = props.rest ?? left;
  const count = countLine({ left, rest, away: props.away, part: props.part }, words);
  // "All marked" sits by the counts at the top (issue 412), so with nothing left the bar goes.
  if (left === 0 && !(r.fresh && r.text)) return null;
  const button = offered(marks, rest, props.offer);
  return (
    <div
      data-rest-bar
      className="sticky bottom-[calc(3.5rem+4px+env(safe-area-inset-bottom))] z-10 shadow-[0_4px_0_0_var(--paper)] md:shadow-none -mx-4 mt-4 border-t-2 border-ink bg-paper px-4 py-2 md:-mx-6 md:px-6 md:bottom-0 md:pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
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
      ) : (
        <div className="flex items-center gap-3">
          <p
            className={`min-w-0 flex-1 text-body-sm tabular-nums ${button ? "max-sm:sr-only" : ""}`}
          >
            {count}
          </p>
          {button && (
            <button
              type="button"
              disabled={r.busy}
              onClick={props.onRest}
              className={buttonClass("secondary", "w-full text-body-sm sm:w-auto")}
            >
              {fill(button, { n: rest })}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
