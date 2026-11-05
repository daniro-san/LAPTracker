// A number in two spellings: compact (3.94B) and exact (3,938,123,456). The "Exact numbers" switch in
// the header shows one or the other for the whole page with CSS only (globals.css), so it works on
// touch and without JavaScript. Deltas carry a sign character and an arrow: colour is never the only cue.
import { compact, exact, percent, percentText, signOf } from "./format";

const MUTED = "text-zinc-500 dark:text-zinc-400";

export function Num({ n }: { n: number | null }) {
  if (n === null) return <span className={MUTED}>—</span>;
  return (
    <>
      <span className="num-c">{compact(n)}</span>
      <span className="num-f">{exact(n)}</span>
    </>
  );
}

function tone(delta: number): string {
  if (delta > 0) return "text-emerald-700 dark:text-emerald-400";
  if (delta < 0) return "text-red-700 dark:text-red-400";
  return MUTED;
}

const arrow = (delta: number) => (delta > 0 ? "▲" : delta < 0 ? "▼" : "•");

/** `▲ +20.1M (+0.5%)`; `—` when there is no delta (a stale or missing side, or only one snapshot). */
export function Delta({
  delta,
  base,
  note,
}: {
  delta: number | null;
  /** The value the percentage is relative to. */
  base: number | null;
  note?: string | undefined;
}) {
  if (delta === null) return <span className={MUTED}>—</span>;
  const pct = percent(delta, base);
  return (
    <span className={`whitespace-nowrap font-medium ${tone(delta)}`}>
      <span aria-hidden="true">{arrow(delta)} </span>
      {signOf(delta)}
      <Num n={Math.abs(delta)} />
      {pct !== null && delta !== 0 && ` (${percentText(pct)})`}
      {note && <span className="whitespace-normal font-normal"> · {note}</span>}
    </span>
  );
}
