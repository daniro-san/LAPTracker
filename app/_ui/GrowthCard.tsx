// The growth card (issue 822), shared by the alliance page and the player page (issue 824): one small line
// chart per measure, stacked on one time axis (never a dual axis, D158), over 7, 30 or 90 days of daily reads,
// each with its change line (`+258.8M over 7 days`). The range is in the address (`?range=30d`), so a link
// reopens it; the charts are drawn on the server (D68). The player page adds its events: a lead line, the
// event readings as hollow dots inside their Start-to-End windows, and a note under the first chart.
import Link from "next/link";
import type { ReactNode } from "react";

import type { Dictionary } from "@/lib/copy";
import { fill } from "@/lib/words";

import { LineChart } from "./charts/LineChart";
import { dayDate, type Clock } from "./format";
import { changeLine, GROWTH_RANGES, inRange, type GrowthRange } from "./growth";
import { LABEL } from "./StatTable";

export interface GrowthSeries {
  /** Unique on the page: the readout's id. */
  key: string;
  label: string;
  /** One point per daily read, oldest first; every series of a card has the same days. */
  points: { day: string; value: number }[];
  /** Readings of another cadence (an event's Start or End), drawn as hollow dots off the line. */
  marks?: { at: Date; value: number }[];
  format: (n: number) => string;
}

/** `dayDate` is noon of the day: a mark or window from the range's first day on is in the range. */
const HALF_DAY_MS = 12 * 3_600_000;

function Ranges({
  range,
  hrefOf,
  copy,
}: {
  range: GrowthRange;
  hrefOf: (r: GrowthRange) => string;
  copy: Dictionary;
}) {
  return (
    <nav aria-label={copy.alliancePage.range}>
      <ul className="flex gap-2">
        {GROWTH_RANGES.map((r) => (
          <li key={r}>
            <Link
              href={hrefOf(r)}
              scroll={false}
              aria-current={r === range ? "page" : undefined}
              className="drawn-frame-soft tint-button inline-flex min-h-11 min-w-11 items-center justify-center px-3 text-sm font-medium tabular-nums text-plum aria-[current=page]:bg-plum/10"
            >
              {fill(copy.alliancePage.days, { n: r })}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function GrowthCard({
  series,
  range,
  hrefOf,
  clock,
  copy,
  lead,
  bands = [],
  note,
}: {
  series: GrowthSeries[];
  range: GrowthRange;
  hrefOf: (r: GrowthRange) => string;
  clock: Clock;
  copy: Dictionary;
  /** A line above the charts. */
  lead?: ReactNode;
  /** Event windows, from Start to End, marked on every chart. */
  bands?: { from: Date; to: Date }[];
  /** A line under the first chart. */
  note?: ReactNode;
}) {
  const shown = series.map((s) => {
    const points = inRange(s.points, range);
    const from = points[0] ? dayDate(points[0].day).getTime() - HALF_DAY_MS : Infinity;
    const marks = (s.marks ?? []).filter((m) => m.at.getTime() >= from);
    return { ...s, points, marks, from };
  });
  const enough = shown.every((s) => s.points.length >= 2);
  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-subhead text-display-md">{copy.alliancePage.growth}</h2>
        <Ranges range={range} hrefOf={hrefOf} copy={copy} />
      </div>
      {!enough ? (
        <p className="text-sm text-ink/70">{copy.ledger.progressEmpty}</p>
      ) : (
        <div className="drawn-card p-3">
          {lead && <p className="mb-3">{lead}</p>}
          {shown.map((s, i) => {
            const line = changeLine(s.points, s.format, copy);
            return (
              <div key={s.key} className={i > 0 ? "mt-4" : undefined}>
                <h3 className={LABEL}>{s.label}</h3>
                {line && <p className="mb-1 tabular-nums">{line}</p>}
                <LineChart
                  points={[
                    ...s.points.map((p) => ({ at: dayDate(p.day), value: p.value })),
                    ...s.marks.map((m) => ({ ...m, mark: true })),
                  ].sort((a, b) => a.at.getTime() - b.at.getTime())}
                  bands={bands.filter((b) => b.to.getTime() >= s.from)}
                  label={s.label}
                  value={s.format}
                  date={clock.day}
                  time={clock.hhmm}
                  small
                  readout={{ id: `growth-${s.key}` }}
                  copy={copy}
                />
                {i === 0 && note}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
