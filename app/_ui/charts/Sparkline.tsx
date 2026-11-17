// A small rank line for one table row (D68, D90): hand-built inline SVG, shapes only (the line and a dot on
// the newest reading), no <text>. Rank 1 is at the top. Its numbers are in the row and in the Details
// table; the drawing only shows the shape. Colours are tokens, so dark mode follows.
export interface SparkPoint {
  /** 0 (oldest) to 1 (newest): the day's place along the period. */
  at: number;
  rank: number;
}

/** The line is drawn inside this margin of the 100 × 100 box, so the dots are not clipped. */
const PAD = 8;
/** The rank range drawn is at least this many places, so a one-place move does not fill the height. */
const MIN_SPAN = 4;

export function Sparkline({ points, label }: { points: SparkPoint[]; label: string }) {
  const ranks = points.map((p) => p.rank);
  const [lo, hi] = [Math.min(...ranks), Math.max(...ranks)];
  const span = Math.max(hi - lo, MIN_SPAN);
  const floor = (lo + hi) / 2 - span / 2;
  const at = (p: SparkPoint) =>
    `${(PAD + p.at * (100 - 2 * PAD)).toFixed(2)} ${(PAD + ((p.rank - floor) / span) * (100 - 2 * PAD)).toFixed(2)}`;
  const last = points.at(-1);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="block h-8 w-16 shrink-0 overflow-visible text-ink"
    >
      <path
        d={points.map((p, i) => `${i === 0 ? "M" : "L"}${at(p)}`).join("")}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {last && (
        <path
          d={`M${at(last)}h0`}
          stroke="currentColor"
          strokeWidth={6}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
