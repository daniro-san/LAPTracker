"use client";

// A number in two spellings: compact (3.94B) and exact (3,938,123,456), both in the viewer's locale. The
// "Exact numbers" switch shows one or the other for the whole page with CSS only (globals.css). Every
// change carries three channels (DESIGN.md): colour, an arrow and the signed number.
import { copy } from "@/lib/copy";

import { compact, exact, MEMBER_MARK, percent, percentText, signOf } from "./format";
import { useLocale } from "./LocaleProvider";

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
  return (
    <>
      <span aria-hidden="true"> {MEMBER_MARK}</span>
      <span className="sr-only"> {copy.legend.members}</span>
    </>
  );
}

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
  /** Puts the percent on its own line below 640 px, for narrow columns. */
  stack?: boolean;
  /** Adds the `*` mark (the total fell and members left). */
  memberMark?: boolean;
}) {
  const locale = useLocale();
  if (delta === null) return <span className={MUTED}>—</span>;
  const pct = percent(delta, base);
  return (
    <span className={`font-medium ${tone(delta)}`}>
      {/* Only the change itself stays on one line; a note may wrap under it (07c S10). */}
      <span className="whitespace-nowrap">
        <span aria-hidden="true">{arrow(delta)} </span>
        {delta !== 0 && signOf(delta)}
        <Num n={Math.abs(delta)} />
        {pct !== null && delta !== 0 && (
          <span suppressHydrationWarning className={stack ? "block sm:inline" : undefined}>
            {" "}
            ({percentText(pct, locale)})
          </span>
        )}
        {memberMark && <MemberMark />}
      </span>
      {note && <span className="font-normal"> · {note}</span>}
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
