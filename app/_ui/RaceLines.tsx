"use client";
// The lines of "Race to #1" (issue 285), drawn inside the readout (D158 rule 7 (a)). The chosen alliance's
// line is drawn last, so no crossing hides it, and the others are dimmed. Shapes only (D68): each line runs
// from its place today (left) to its place in RACE_AHEAD weeks (right), one unit per place on both sides.
import { useReadoutAt } from "./charts/Readout";

export interface RaceLine {
  /** Row i of the readout: today's place order. */
  at: number;
  /** The row's middle on each side, in places from the top. */
  from: number;
  to: number;
  /** Takes #1 or moves 2 places or more: drawn heavier. */
  heavy: boolean;
}

const STROKE = { vectorEffect: "non-scaling-stroke", stroke: "currentColor" } as const;

export function RaceLines({ lines }: { lines: RaceLine[] }) {
  const chosen = useReadoutAt();
  const drawn = [...lines.filter((l) => l.at !== chosen), ...lines.filter((l) => l.at === chosen)];
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 100 ${lines.length}`}
      preserveAspectRatio="none"
      className="h-full w-full overflow-visible"
    >
      {drawn.map((l) => (
        <g
          key={l.at}
          data-at={l.at}
          className={
            l.at === chosen ? "text-plum" : chosen === null ? "text-ink/40" : "text-ink/25"
          }
        >
          <line x1={0} y1={l.from} x2={100} y2={l.to} strokeWidth={l.heavy ? 4 : 2} {...STROKE} />
          {[
            [0, l.from],
            [100, l.to],
          ].map(([x, y]) => (
            <line
              key={x}
              x1={x}
              y1={y}
              x2={x}
              y2={y}
              strokeWidth={8}
              strokeLinecap="round"
              {...STROKE}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
