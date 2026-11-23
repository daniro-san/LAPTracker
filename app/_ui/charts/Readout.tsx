"use client";
// The readout under a chart whose columns are too narrow to tap one by one (D158 rule 7 (a)): one line that
// names the chosen column, its number with its unit and what it is out of, with 44 px ‹ › steps. A tap on a
// column (`data-at="<i>"` inside the chart) jumps straight to it, and the chosen column is marked
// (`aria-current`). The line is announced (`aria-live`). The choice is in the address fragment
// (`#at-<id>-<i>`, replaceState: no jump, no history entry), so Back to the page shows the same column. The
// chart itself stays server-rendered; this is D68's one small client part. The busiest or newest column is
// chosen first.
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface ReadoutItem {
  /** "11:00–11:15", the column's name. */
  label: string;
  /** "10.2K kills · 5 alliances": its numbers with their units and what they are out of. */
  line: string;
}

const STEP =
  "tint-button flex min-h-11 min-w-11 shrink-0 items-center justify-center text-lg font-semibold disabled:opacity-40";

/** The column the fragment names for this readout, or null. */
export function atOf(hash: string, id: string, count: number): number | null {
  const m = new RegExp(`^#at-${id}-(\\d+)$`).exec(hash);
  const i = m ? Number(m[1]) : NaN;
  return Number.isInteger(i) && i >= 0 && i < count ? i : null;
}

export function Readout(props: {
  /** Unique on the page: the fragment's name. */
  id: string;
  items: ReadoutItem[];
  initial: number;
  words: { earlier: string; later: string };
  /** Kept at the bottom of the window while the chart scrolls (many strips: the fight clock). */
  sticky?: boolean;
  children: ReactNode;
}) {
  const { id, items } = props;
  const [at, setAt] = useState(props.initial);
  const box = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  useEffect(() => {
    const from = atOf(window.location.hash, id, items.length);
    if (from !== null) setAt(from);
  }, [id, items.length]);
  useEffect(() => {
    for (const el of box.current?.querySelectorAll<HTMLElement>("[data-at]") ?? [])
      el.setAttribute("aria-current", String(el.dataset.at === String(at)));
    if (!moved.current) return;
    const url = new URL(window.location.href);
    url.hash = `at-${id}-${at}`;
    try {
      window.history.replaceState(window.history.state, "", url);
    } catch {
      // Refused by the browser's limit on history changes: keep the address.
    }
  }, [at, id]);
  const go = (i: number) => {
    moved.current = true;
    setAt(Math.max(0, Math.min(items.length - 1, i)));
  };
  const item = items[at];
  return (
    <div>
      {/* A tap on a column is a shortcut to it; the steps below are the keyboard's and the screen reader's way. */}
      <div
        ref={box}
        onClick={(e) => {
          const col = (e.target as HTMLElement).closest<HTMLElement>("[data-at]");
          if (col) go(Number(col.dataset.at));
        }}
      >
        {props.children}
      </div>
      {item && (
        <div
          className={`mt-2 flex items-center gap-1 border-y border-rule ${props.sticky ? "sticky bottom-0 z-[5] bg-paper" : ""}`}
        >
          <button
            type="button"
            aria-label={props.words.earlier}
            disabled={at === 0}
            onClick={() => go(at - 1)}
            className={STEP}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <p
            aria-live="polite"
            className="min-w-0 flex-1 py-1 text-center text-body-sm tabular-nums"
          >
            <span className="font-semibold">{item.label}</span>
            {" · "}
            {item.line}
          </p>
          <button
            type="button"
            aria-label={props.words.later}
            disabled={at === items.length - 1}
            onClick={() => go(at + 1)}
            className={STEP}
          >
            <span aria-hidden="true">›</span>
          </button>
        </div>
      )}
    </div>
  );
}
