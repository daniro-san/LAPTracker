"use client";

// The tappable `*` beside a Might or Kills change that members who joined or left moved (D69 amendment,
// 2026-11-21): a disclosure with the total, what the joiners came in with, what the leavers took and the
// change without them. The change itself stays the alliance's total. Nothing hover-only; the target is 44 px.
// A tap outside it or Escape closes it.

import { useEffect, useRef, type ReactNode } from "react";

import { fill } from "@/lib/copy";

import { MEMBER_MARK, signOf } from "./format";
import { useCopy } from "./LocaleProvider";
import { Num } from "./Num";

/** `joined.value`: what the joiners brought into the total; `left.value`: what the leavers took out of it. */
export interface MetricSplit {
  joined: { n: number; value: number };
  left: { n: number; value: number };
}

function Signed({ n }: { n: number }) {
  return (
    <span className="whitespace-nowrap">
      {signOf(n)}
      <Num n={Math.abs(n)} />
    </span>
  );
}

/** Closes `details` on a tap outside it or on Escape. */
function useDismiss() {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: Event) => {
      const details = ref.current;
      if (!details?.open) return;
      const outside = e instanceof PointerEvent && !details.contains(e.target as Node);
      if (outside || (e instanceof KeyboardEvent && e.key === "Escape")) details.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return ref;
}

/**
 * The panel is placed against the nearest positioned box (below 640 px the card, at 640 px and up the
 * figure's cell; the alliance page's summary band), under the mark. `name`: what the mark is about, for a
 * screen reader ("Kills, [TAG] Name").
 */
export function SplitMark({
  total,
  split,
  name,
}: {
  total: number;
  split: MetricSplit;
  name: ReactNode;
}) {
  const ref = useDismiss();
  const copy = useCopy();
  const s = copy.split;
  const lines: [string, number][] = [
    [s.total, total],
    ...(split.joined.n > 0
      ? [[fill(s.joined, { n: String(split.joined.n) }), split.joined.value] as [string, number]]
      : []),
    ...(split.left.n > 0
      ? [[fill(s.left, { n: String(split.left.n) }), -split.left.value] as [string, number]]
      : []),
    [s.without, total - split.joined.value + split.left.value],
  ];
  return (
    <details ref={ref} className="group/split inline-block align-baseline">
      <summary className="relative z-10 -my-3 inline-flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center font-semibold text-plum group-open/split:bg-plum/10 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true">{MEMBER_MARK}</span>
        <span className="sr-only">
          {s.open}, {name}
        </span>
      </summary>
      <dl className="absolute inset-x-2 z-30 mt-1 border border-rule bg-paper p-3 text-left text-sm font-normal text-ink shadow-[0_8px_24px_var(--sheet-shadow)] sm:left-auto sm:w-72">
        {lines.map(([label, n], i) => (
          <div
            key={label}
            className={`flex items-baseline justify-between gap-3 py-0.5 ${i === lines.length - 1 ? "mt-1 border-t border-rule pt-1.5 font-medium" : ""}`}
          >
            <dt>{label}</dt>
            <dd className="tabular-nums">
              <Signed n={n} />
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
