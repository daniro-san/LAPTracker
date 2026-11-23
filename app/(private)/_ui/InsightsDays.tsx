// A week's days on Insights (D158 rule 7 (b), chart to chart): the seven day columns of the week's pulse, and
// the next level a week row opens in its chart's place, under its path and a 44 px Back step, with the line
// that says its days add up to the week. Server-rendered, every number in HTML (D68); the level is in the
// address (`?pulse=` / `?flow=`), so a link reopens it.
import { Bar } from "@/app/_ui/charts/Bar";
import { DrillPath } from "@/app/_ui/charts/DrillPath";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { FlowDaysWords, PulseDaysWords } from "@/lib/private/insights-days-words";
import type { BarRow, DayBar } from "@/lib/private/insights-words";

import { withNoData } from "./NoData";

/** A week's seven days, one column each: the bar, a hairline, the number under it. */
export function Days({ days, noData }: { days: DayBar[]; noData: string }) {
  return (
    <ol className="mt-2 grid grid-cols-7 gap-0.5 text-center">
      {days.map((d) => (
        <li key={d.weekday} className="min-w-0">
          {!d.later && <span className="sr-only">{`${d.weekday}: ${d.value}`}</span>}
          <span aria-hidden="true" className="block text-[12px] leading-4 text-ink/70">
            {d.weekday}
          </span>
          <span aria-hidden="true" className="flex h-8 items-end justify-center">
            <Bar
              axis="column"
              share={d.share}
              tone="rounded-t-sm bg-plum/60"
              className="h-full w-full max-w-6"
            />
          </span>
          <span aria-hidden="true" className="block h-px bg-ink/50" />
          <span aria-hidden="true" className="block truncate text-[12px] leading-5 tabular-nums">
            {d.later ? "" : withNoData(d.value, noData)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A pulse week's days, each metric as its seven columns and the line its days add up to. */
export function PulseDays(props: {
  level: PulseDaysWords;
  /** The card's own address: the weeks again. */
  top: string;
  t: WorkspaceDictionary;
  noData: string;
}) {
  const { level, top, t, noData } = props;
  return (
    <>
      <DrillPath
        name={t["drill.path"]}
        back={{ href: top, label: t["drill.back"] }}
        steps={[{ label: t["insights.pulse.head"], href: top }, { label: level.label }]}
      />
      {level.noRead && <p className="text-body-sm text-ink/80">{level.noRead}</p>}
      {level.metrics.map((m) => (
        <div key={m.label} className="mt-3 border-t-2 border-rule pt-2">
          <h3 className="font-semibold">{m.label}</h3>
          <Days days={m.days} noData={noData} />
          <p className="mt-2 text-body-sm tabular-nums">{withNoData(m.sum, noData)}</p>
        </div>
      ))}
    </>
  );
}

/** One side of a day: its count and its bar against the members. */
function Side({ r, noData, tone }: { r: BarRow; noData: string; tone: string }) {
  return (
    <span className="block border-t border-rule py-1.5">
      <span className="flex items-baseline justify-between gap-x-2 text-body-sm">
        <span>{r.label}</span>
        <span className="tabular-nums">{withNoData(r.value, noData)}</span>
      </span>
      <Bar axis="row" share={r.share} tone={tone} className="mt-1 h-2 w-full bg-ink/10" />
    </span>
  );
}

/** A flow week's days, joined and left side by side, then the line its days add up to. */
export function FlowDays(props: {
  level: FlowDaysWords;
  top: string;
  t: WorkspaceDictionary;
  noData: string;
}) {
  const { level, top, t, noData } = props;
  return (
    <>
      <DrillPath
        name={t["drill.path"]}
        back={{ href: top, label: t["drill.back"] }}
        steps={[{ label: t["insights.flow.head"], href: top }, { label: level.label }]}
      />
      <ul className="mt-1">
        {level.days.map((d) => (
          <li key={d.label} className="border-t border-rule py-1.5">
            <span className="block text-body-sm font-semibold">{d.label}</span>
            <span className="grid grid-cols-2 gap-x-3">
              <Side r={d.joined} noData={noData} tone="bg-plum/60" />
              <Side r={d.left} noData={noData} tone="bg-ink/45" />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-rule pt-2 text-body-sm font-medium tabular-nums">
        {level.sum}
      </p>
      {level.notes.map((n) => (
        <p key={n} className="text-body-sm text-ink/80">
          {n}
        </p>
      ))}
    </>
  );
}
