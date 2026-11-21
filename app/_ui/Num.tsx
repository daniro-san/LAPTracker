"use client";

// A number in two spellings: compact (3.94B) and exact (3,938,123,456), both in the viewer's locale. The
// "Exact numbers" switch shows one or the other for the whole page with CSS only (globals.css). Every
// change carries three channels (DESIGN.md): colour, an arrow and the signed number.

import { fill } from "@/lib/copy";

import { compact, exact, MEMBER_MARK, percent, percentText, ratioText, signOf } from "./format";
import { useCopy, useLocale } from "./LocaleProvider";

const MUTED = "text-ink/70";

export function Num({ n }: { n: number | null }) {
  const locale = useLocale();
  if (n === null) return <span className={MUTED}>—</span>;
  return (
    <>
      <span className="num-c" suppressHydrationWarning>
        {compact(n, locale)}
      </span>
      <span className="num-f" suppressHydrationWarning>
        {exact(n, locale)}
      </span>
    </>
  );
}

function tone(delta: number): string {
  if (delta > 0) return "text-yarn";
  if (delta < 0) return "text-seal";
  return MUTED;
}

const arrow = (delta: number) => (delta > 0 ? "▲" : delta < 0 ? "▼" : "=");

/** `*` after a change: the total fell while members left. The legend names it; a screen reader hears the words. */
export function MemberMark() {
  const copy = useCopy();
  return (
    <>
      <span aria-hidden="true"> {MEMBER_MARK}</span>
      <span className="sr-only"> {copy.legend.members}</span>
    </>
  );
}

/** Where the percent goes for `stack`: under the change below 640 px (true) or 768 px ("md"). */
const STACK = { md: "block md:inline", true: "block sm:inline", false: "" } as const;

/** `▲ +20.1M (+0.5%)`; `—` when there is no delta (a stale or missing side, or only one snapshot). */
export function Delta({
  delta,
  base,
  note,
  stack = false,
  memberMark = false,
}: {
  delta: number | null;
  /** The value the percentage is relative to. */
  base: number | null;
  note?: string | undefined;
  /** Puts the percent on its own line below 640 px, for narrow columns; `"md"`: below 768 px. */
  stack?: boolean | "md";
  /** Adds the `*` mark (the total fell and members left). */
  memberMark?: boolean;
}) {
  const locale = useLocale();
  if (delta === null) return <span className={MUTED}>—</span>;
  const pct = percent(delta, base);
  const shown = pct !== null && delta !== 0;
  return (
    <span className={`font-medium ${tone(delta)}`}>
      {/* The change and its percent are each one unbroken piece, and the `*` stays with the last one; a
          column too narrow for both puts the percent on the next line instead of running into the next
          column (issue 473). A note may wrap under it (07c S10). */}
      <span>
        <span className="whitespace-nowrap">
          <span aria-hidden="true">{arrow(delta)} </span>
          {delta !== 0 && signOf(delta)}
          <Num n={Math.abs(delta)} />
          {!shown && memberMark && <MemberMark />}
        </span>
        {shown && (
          <>
            {" "}
            <span
              suppressHydrationWarning
              className={`whitespace-nowrap ${STACK[String(stack) as keyof typeof STACK]}`}
            >
              ({percentText(pct, locale)}){memberMark && <MemberMark />}
            </span>
          </>
        )}
      </span>
      {note && <span className="font-normal"> · {note}</span>}
    </span>
  );
}

/** `3.1× the first`: one change as a multiple of another (the compare page's difference line), muted. */
export function Ratio({ ratio }: { ratio: number }) {
  const locale = useLocale();
  const copy = useCopy();
  return (
    <span className={MUTED} suppressHydrationWarning>
      {fill(copy.compare.ratio, { ratio: ratioText(ratio, locale) })}
    </span>
  );
}

/** Rank movement: `▲2` up, `▼1` down, `=` held, `—` without a previous rank (compute.rankDelta). */
export function RankMove({ move }: { move: number | null }) {
  if (move === null) return <span className={MUTED}>—</span>;
  return (
    <span className={`whitespace-nowrap font-medium ${tone(move)}`}>
      {arrow(move)}
      {move !== 0 && Math.abs(move)}
    </span>
  );
}

/** `#3 ▲1`: the rank, language-free, and how it moved. No `move` at all: only the rank. */
export function Rank({ n, move }: { n: number | null; move?: number | null | undefined }) {
  return (
    <span className="inline-flex items-baseline gap-1 tabular-nums">
      <span className="font-semibold text-ink">{n === null ? "#—" : `#${n}`}</span>
      {move !== undefined && (
        <span className="text-xs">
          <RankMove move={move} />
        </span>
      )}
    </span>
  );
}
