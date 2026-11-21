// A line over time (D68): hand-built inline SVG, no chart library. The SVG holds only the line and its
// dots; every label (highest and lowest value, first and last date) and every event mark is HTML around
// it, never SVG <text>, so the same drawing can go into a next/og picture, whose Satori renderer refuses
// <text>. Colours are tokens, so dark mode follows. The numbers themselves sit in text or a table beside
// the chart; the chart only shows their shape.
import { fill, type Dictionary } from "@/lib/copy";

export interface ChartPoint {
  at: Date;
  value: number;
  /** Read at an event: it keeps its dot when the line has too many readings for a dot each. */
  mark?: boolean;
}

/** Shapes are drawn in a 100 × 100 box stretched to the chart's size; strokes keep their width. */
const BOX = 100;
/** The top and bottom hairlines. */
const EDGES = `M0 0H${BOX}M0 ${BOX}H${BOX}`;
const MUTED = "text-xs tabular-nums text-ink/70";
/** Up to this many readings every reading has a dot. */
const DOTS_EACH = 30;
/** The line's value range is at least this share of its highest value, so a flat line draws flat. */
const MIN_SPAN = 0.05;
/** An event mark is at least this wide in px; an event wider than this share of the chart is a tick at each end. */
const MARK_PX = 6;
const WIDE_EVENT = 40;
/** The chart's height in px (Tailwind h-32 and h-16) and the least gap between two value labels (text-xs). */
const HEIGHT = { regular: 128, small: 64 };
const LABEL_GAP = 16;
/** The peak's date is written under it only this far (in chart %) from both ends, clear of their dates. */
const PEAK_CLEAR = 20;

/** Time across, value up; the value range is padded around the data when it is under MIN_SPAN of the top. */
function shapes(points: ChartPoint[], first: ChartPoint, last: ChartPoint) {
  const [t0, t1] = [first.at.getTime(), last.at.getTime()];
  const values = points.map((p) => p.value);
  const [lo, hi] = [Math.min(...values), Math.max(...values)];
  const span = Math.max(hi - lo, hi * MIN_SPAN) || 1;
  // Centred on the data, but never below zero for a series that is not: 0 kills sit on the bottom edge.
  const centred = (lo + hi) / 2 - span / 2;
  const floor = lo >= 0 ? Math.max(centred, 0) : centred;
  const x = (d: Date) => (t1 === t0 ? BOX / 2 : ((d.getTime() - t0) / (t1 - t0)) * BOX);
  const y = (v: number) => BOX - ((v - floor) / span) * BOX;
  const at = (p: ChartPoint) => `${x(p.at).toFixed(2)} ${y(p.value).toFixed(2)}`;
  const dotted = points.length <= DOTS_EACH ? points : points.filter((p) => p.mark);
  return {
    x,
    lo,
    hi,
    yLo: y(lo),
    yHi: y(hi),
    line: points.map((p, i) => `${i === 0 ? "M" : "L"}${at(p)}`).join(""),
    // A zero-length segment with a round cap is a dot that stays round when the box is stretched.
    dots: dotted.map((p) => `M${at(p)}h0`).join(""),
  };
}

/**
 * The highest and the lowest value, each beside its own height on the line. Equal texts give one label;
 * two labels closer than a line of text are moved apart around their middle.
 */
function valueLabels(hi: string, lo: string, yHi: number, yLo: number, height: number) {
  const [a, b] = [(yHi / BOX) * height, (yLo / BOX) * height];
  if (hi === lo) return [{ text: hi, top: (a + b) / 2 }];
  if (b - a >= LABEL_GAP)
    return [
      { text: hi, top: a },
      { text: lo, top: b },
    ];
  const top = Math.min(Math.max((a + b) / 2 - LABEL_GAP / 2, 0), height - LABEL_GAP);
  return [
    { text: hi, top },
    { text: lo, top: top + LABEL_GAP },
  ];
}

/** Each event from its Start to its End (in chart %); a wide event is a tick at each end instead. */
function EventMarks({ bands, x }: { bands: { from: Date; to: Date }[]; x: (d: Date) => number }) {
  const marks = bands.flatMap((b) => {
    const [from, to] = [x(b.from), x(b.to)];
    return to - from > WIDE_EVENT
      ? [
          { from, to: from },
          { from: to, to },
        ]
      : [{ from, to }];
  });
  return marks.map((m) => (
    <div
      key={`${m.from}|${m.to}`}
      aria-hidden="true"
      className="absolute inset-y-0 bg-ink/50"
      style={{
        left: `calc(${(m.from + m.to) / 2}% - max(${(m.to - m.from) / 2}%, ${MARK_PX / 2}px))`,
        width: `max(${m.to - m.from}%, ${MARK_PX}px)`,
      }}
    />
  ));
}

/**
 * The highest reading's date under it (issue 473), when it is not near the first or the last reading,
 * whose dates are written already. The newest of equal highs.
 */
function PeakDate({
  points,
  hi,
  x,
  when,
}: {
  points: ChartPoint[];
  hi: number;
  x: (d: Date) => number;
  when: (d: Date) => string;
}) {
  const peak = points.findLast((p) => p.value === hi);
  const left = peak ? x(peak.at) : 0;
  if (!peak || left < PEAK_CLEAR || left > BOX - PEAK_CLEAR) return null;
  return (
    <span
      className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
      style={{ left: `${left}%` }}
    >
      ↑ {when(peak.at)}
    </span>
  );
}

interface LineChartProps {
  /** Oldest first, at least two. */
  points: ChartPoint[];
  /** An event's time window, from its Start to its End reading; each is marked on the chart. */
  bands?: { from: Date; to: Date }[];
  /** What the line is, e.g. "Might": the start of the accessible name. */
  label: string;
  value: (n: number) => string;
  date: (d: Date) => string;
  /** Time of day: the first and last date also show it when they fall on the same day. */
  time: (d: Date) => string;
  small?: boolean;
  copy: Dictionary;
}

export function LineChart({
  points,
  bands = [],
  label,
  value,
  date,
  time,
  small = false,
  copy,
}: LineChartProps) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const { x, lo, hi, yLo, yHi, line, dots } = shapes(points, first, last);
  const sameDay = date(first.at) === date(last.at);
  const when = (d: Date) => (sameDay ? `${date(d)}, ${time(d)}` : date(d));
  const name = fill(copy.ledger.chart, {
    label,
    first: value(first.value),
    from: when(first.at),
    last: value(last.value),
    to: when(last.at),
  });
  const labels = valueLabels(value(hi), value(lo), yHi, yLo, small ? HEIGHT.small : HEIGHT.regular);
  return (
    <figure className="flex gap-2">
      <div className="min-w-0 flex-1 px-1">
        <div className="relative">
          <EventMarks bands={bands} x={x} />
          <svg
            role="img"
            aria-label={name}
            viewBox={`0 0 ${BOX} ${BOX}`}
            preserveAspectRatio="none"
            className={`relative block w-full overflow-visible text-ink ${small ? "h-16" : "h-32"}`}
          >
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
        </div>
        <div aria-hidden="true" className={`relative mt-1 flex justify-between ${MUTED}`}>
          <span>{when(first.at)}</span>
          <PeakDate points={points} hi={hi} x={x} when={when} />
          <span>{when(last.at)}</span>
        </div>
      </div>
      {/* A fixed width, so the charts of one card line up whatever their labels. */}
      <div aria-hidden="true" className={`relative w-14 shrink-0 text-right ${MUTED}`}>
        {labels.map((l) => (
          <span key={l.top} className="absolute right-0 -translate-y-1/2" style={{ top: l.top }}>
            {l.text}
          </span>
        ))}
      </div>
    </figure>
  );
}
