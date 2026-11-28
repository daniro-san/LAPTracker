// The growth card (issue 822), shared by the alliance page and the player page (issue 824): one small line
// chart per measure, stacked on one time axis (never a dual axis, D158), over 7, 30 or 90 days of daily reads,
// each with its change line (`+258.8M over 7 days`). The range is in the address (`?range=30d`), so a link
// reopens it; the charts are drawn on the server (D68).
import Link from "next/link";

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
  format: (n: number) => string;
}

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
}: {
  series: GrowthSeries[];
  range: GrowthRange;
  hrefOf: (r: GrowthRange) => string;
  clock: Clock;
  copy: Dictionary;
}) {
  const shown = series.map((s) => ({ ...s, points: inRange(s.points, range) }));
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
          {shown.map((s, i) => {
            const line = changeLine(s.points, s.format, copy);
            return (
              <div key={s.key} className={i > 0 ? "mt-4" : undefined}>
                <h3 className={LABEL}>{s.label}</h3>
                {line && <p className="mb-1 tabular-nums">{line}</p>}
                <LineChart
                  points={s.points.map((p) => ({ at: dayDate(p.day), value: p.value }))}
                  label={s.label}
                  value={s.format}
                  date={clock.day}
                  time={clock.hhmm}
                  small
                  readout={{ id: `growth-${s.key}` }}
                  copy={copy}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
