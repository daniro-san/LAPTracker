// A line over time (D68): hand-built inline SVG, no chart library. The SVG holds only shapes; every label
// (highest and lowest value, first and last date) is HTML around it, never SVG <text>, so the same
// drawing can go into a next/og picture, whose Satori renderer refuses <text>. Colours are tokens
// through currentColor, so dark mode follows. The numbers themselves sit in text or a table beside the
// chart; the chart only shows their shape.
import { fill, type Dictionary } from "@/lib/copy";

export interface ChartPoint {
  at: Date;
  value: number;
}

/** Shapes are drawn in a 100 × 100 box stretched to the chart's size; strokes keep their width. */
const BOX = 100;
/** The top and bottom hairlines, beside the highest and lowest value. */
const EDGES = `M0 0H${BOX}M0 ${BOX}H${BOX}`;
const MUTED = "text-xs tabular-nums text-ink/70";

/** The highest value beside the top line, the lowest beside the bottom one; pb-5 skips the dates' row. */
function ValueEnds({ hi, lo }: { hi: string; lo: string }) {
  return (
    <div aria-hidden="true" className={`flex flex-col justify-between pb-5 text-right ${MUTED}`}>
      <span className="-translate-y-1/2">{hi}</span>
      <span className="translate-y-1/2">{lo}</span>
    </div>
  );
}

/** Time across, value up (highest at the top edge, lowest at the bottom); the line and its dots. */
function shapes(points: ChartPoint[], first: ChartPoint, last: ChartPoint) {
  const [t0, t1] = [first.at.getTime(), last.at.getTime()];
  const values = points.map((p) => p.value);
  const [lo, hi] = [Math.min(...values), Math.max(...values)];
  const x = (d: Date) => (t1 === t0 ? BOX / 2 : ((d.getTime() - t0) / (t1 - t0)) * BOX);
  const y = (v: number) => (hi === lo ? BOX / 2 : BOX - ((v - lo) / (hi - lo)) * BOX);
  const at = (p: ChartPoint) => `${x(p.at).toFixed(2)} ${y(p.value).toFixed(2)}`;
  return {
    x,
    lo,
    hi,
    line: points.map((p, i) => `${i === 0 ? "M" : "L"}${at(p)}`).join(""),
    // A zero-length segment with a round cap is a dot that stays round when the box is stretched.
    dots: points.map((p) => `M${at(p)}h0`).join(""),
  };
}

interface LineChartProps {
  /** Oldest first, at least two. */
  points: ChartPoint[];
  /** Shaded time windows, e.g. an event from Start to End. */
  bands?: { from: Date; to: Date }[];
  /** What the line is, e.g. "Might": the start of the accessible name. */
  label: string;
  value: (n: number) => string;
  date: (d: Date) => string;
  small?: boolean;
  copy: Dictionary;
}

export function LineChart({
  points,
  bands = [],
  label,
  value,
  date,
  small = false,
  copy,
}: LineChartProps) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const { x, lo, hi, line, dots } = shapes(points, first, last);
  const name = fill(copy.ledger.chart, {
    label,
    first: value(first.value),
    from: date(first.at),
    last: value(last.value),
    to: date(last.at),
  });
  return (
    <figure className="flex gap-2">
      <div className="min-w-0 flex-1 px-1">
        <svg
          role="img"
          aria-label={name}
          viewBox={`0 0 ${BOX} ${BOX}`}
          preserveAspectRatio="none"
          className={`block w-full overflow-visible text-ink ${small ? "h-16" : "h-32"}`}
        >
          {bands.map((b) => (
            <rect
              key={b.from.getTime()}
              x={x(b.from)}
              y={0}
              width={Math.max(x(b.to) - x(b.from), 0)}
              height={BOX}
              fill="currentColor"
              className="text-rule"
            />
          ))}
          <path
            d={EDGES}
            stroke="currentColor"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            className="text-rule"
          />
          <path
            d={line}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={dots}
            stroke="currentColor"
            strokeWidth={small ? 5 : 6}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div aria-hidden="true" className={`mt-1 flex justify-between ${MUTED}`}>
          <span>{date(first.at)}</span>
          <span>{date(last.at)}</span>
        </div>
      </div>
      <ValueEnds hi={value(hi)} lo={value(lo)} />
    </figure>
  );
}
