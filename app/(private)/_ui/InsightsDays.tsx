// A week's days on Insights (D158 rule 7 (b), chart to chart): the seven day columns of the week's pulse, and
// the next level a week row opens in its chart's place, under its path and a 44 px Back step, with the line
// that says its days add up to the week; then a day's level: the pulse's who lists (pattern (c), names in
// place) and the flow's came-from and went-to bars (counts only, D75). Server-rendered, every number in HTML
// (D68); the level is in the address (`?pulse=`, `?pulseDay=`, `?flow=`, `?flowDay=`), so a link reopens it.
import { Bar } from "@/app/_ui/charts/Bar";
import { DrillPath } from "@/app/_ui/charts/DrillPath";
import type { InsightsLevel } from "@/lib/analytics/events";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type {
  FlowDaysWords,
  FlowDayWords,
  PulseDaysWords,
  PulseDayWords,
} from "@/lib/private/insights-days-words";
import type { BarRow, DayBar, DayPick } from "@/lib/private/insights-words";

import { Bars, Sub } from "./InsightsBars";
import { InsightsDrillLink } from "./InsightsDrillLink";
import { TapHint } from "./InsightsSets";
import { withNoData } from "./NoData";

/** Where a day level links: the card itself, the week it sits in, and a day of it. */
export interface DayHrefs {
  top: string;
  week: (monday: string | null) => string;
  day: (day: string) => string;
}

/**
 * The days under a 7-column grid as a row of 44 px links, each opening that day's level: a column is about
 * 40 px wide at 360 px, narrower than a tap target. The weekday shows; the full date is the link's name.
 */
export function DayPicks(props: {
  label: string;
  picks: DayPick[];
  href: (day: string) => string;
  kind: InsightsLevel;
}) {
  if (props.picks.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-body-sm text-ink/80">{props.label}</p>
      <ul className="mt-1 flex flex-wrap gap-1">
        {props.picks.map((p) => (
          <li key={p.key}>
            <InsightsDrillLink
              href={props.href(p.key)}
              kind={props.kind}
              count={p.count}
              className="tint-button inline-flex min-h-11 min-w-11 items-center justify-center border border-plum/40 px-2 text-body-sm font-semibold text-plum"
            >
              <span aria-hidden="true">{p.weekday}</span>
              <span className="sr-only">{p.date}</span>
            </InsightsDrillLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A week's seven days, one column each: the bar, a hairline, the number under it. */
export function Days({ days, noData }: { days: DayBar[]; noData: string }) {
  return (
    <ol className="mt-2 grid grid-cols-7 gap-0.5 text-center">
      {days.map((d) => (
        <li key={d.weekday} className="min-w-0">
          {!d.later && (
            <span className="sr-only">{`${d.weekday}: ${d.value}${d.of ? ` (${d.of})` : ""}`}</span>
          )}
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
          {d.of && (
            <span
              aria-hidden="true"
              className="block truncate text-[12px] leading-4 text-ink/70 tabular-nums"
            >
              {d.of}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** A pulse week's days, each metric as its seven columns and the line its days add up to. */
export function PulseDays(props: {
  level: PulseDaysWords;
  hrefs: DayHrefs;
  t: WorkspaceDictionary;
  noData: string;
}) {
  const { level, hrefs, t, noData } = props;
  return (
    <>
      <DrillPath
        name={t["drill.path"]}
        back={{ href: hrefs.top, label: t["drill.back"] }}
        steps={[{ label: t["insights.pulse.head"], href: hrefs.top }, { label: level.label }]}
        sticky
      />
      {level.noRead && <p className="text-body-sm text-ink/80">{level.noRead}</p>}
      <DayPicks
        label={t["drill.pulse.pick"]}
        picks={level.picks}
        href={hrefs.day}
        kind="pulse_day"
      />
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

/** A flow day's label and its joined and left side by side. */
function FlowDayRow({ d, noData }: { d: FlowDaysWords["days"][number]; noData: string }) {
  return (
    <>
      <span className="block text-body-sm font-semibold">
        {d.label}
        {d.drill && (
          <span aria-hidden="true" className="ml-1 text-plum">
            ›
          </span>
        )}
      </span>
      <span className="grid grid-cols-2 gap-x-3">
        <Side r={d.joined} noData={noData} tone="bg-plum/60" />
        <Side r={d.left} noData={noData} tone="bg-ink/45" />
      </span>
    </>
  );
}

/** A flow week's days, joined and left side by side, then the line its days add up to. */
export function FlowDays(props: {
  level: FlowDaysWords;
  hrefs: DayHrefs;
  t: WorkspaceDictionary;
  noData: string;
}) {
  const { level, hrefs, t, noData } = props;
  return (
    <>
      <DrillPath
        name={t["drill.path"]}
        back={{ href: hrefs.top, label: t["drill.back"] }}
        steps={[{ label: t["insights.flow.head"], href: hrefs.top }, { label: level.label }]}
        sticky
      />
      <ul className="mt-1">
        {level.days.map((d) => (
          <li key={d.label} className={`border-t border-rule ${d.drill ? "" : "py-1.5"}`}>
            {/* A day with a join or a leave opens where they came from and went (D158 rule 7 (b)). */}
            {d.drill ? (
              <InsightsDrillLink
                href={hrefs.day(d.drill.key)}
                kind="flow_day"
                count={d.drill.count}
                className="tint-button block min-h-11 py-1.5"
              >
                <FlowDayRow d={d} noData={noData} />
              </InsightsDrillLink>
            ) : (
              <FlowDayRow d={d} noData={noData} />
            )}
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

/** A day level's path: the chart, the week the day sits in, the day; Back goes to the week. */
function DayPath(props: {
  head: string;
  week: string;
  day: string;
  hrefs: DayHrefs;
  monday: string | null;
  t: WorkspaceDictionary;
}) {
  const week = props.hrefs.week(props.monday);
  return (
    <DrillPath
      name={props.t["drill.path"]}
      back={{ href: week, label: props.week }}
      steps={[
        { label: props.head, href: props.hrefs.top },
        { label: props.week, href: week },
        { label: props.day },
      ]}
      sticky
    />
  );
}

/**
 * A pulse day: each measure's count of the members who reached it, its names in place under a tap (pattern
 * (c), in name order, only those who did it), then the day's middle donation and the lines it rests on.
 */
export function PulseDay(props: {
  level: PulseDayWords;
  hrefs: DayHrefs;
  t: WorkspaceDictionary;
  noData: string;
  slug: string;
}) {
  const { level, hrefs, t, noData, slug } = props;
  return (
    <>
      <DayPath
        head={t["insights.pulse.head"]}
        week={level.week.label}
        monday={level.week.monday}
        day={level.label}
        {...{ hrefs, t }}
      />
      <TapHint t={t} />
      <Bars rows={level.rows} noData={noData} sets={{ slug, t }} />
      <p className="mt-2 border-t border-rule pt-2 text-body-sm tabular-nums">
        {withNoData(level.middle, noData)}
      </p>
      <p className="mt-2 border-t border-rule pt-2 text-body-sm font-medium">{level.sum}</p>
      {level.notes.map((n) => (
        <p key={n} className="text-body-sm text-ink/80">
          {n}
        </p>
      ))}
    </>
  );
}

/** A flow day: where its joiners came from and its leavers went, against the members, counts only (D75). */
export function FlowDay(props: {
  level: FlowDayWords;
  hrefs: DayHrefs;
  t: WorkspaceDictionary;
  noData: string;
}) {
  const { level, hrefs, t, noData } = props;
  return (
    <>
      <DayPath
        head={t["insights.flow.head"]}
        week={level.week.label}
        monday={level.week.monday}
        day={level.label}
        {...{ hrefs, t }}
      />
      {/* The day's count first, then the places it is made of (persona panel). */}
      <p className="mt-1 text-body-sm font-medium tabular-nums">{level.sum}</p>
      <Sub>{t["insights.flow.came"]}</Sub>
      {level.joined > 0 ? (
        <Bars rows={level.came} noData={noData} />
      ) : (
        <p className="text-body-sm">{t["drill.flowDay.nobodyJoined"]}</p>
      )}
      <Sub>{t["insights.flow.went"]}</Sub>
      {level.left > 0 ? (
        <Bars rows={level.went} noData={noData} tone="ink" />
      ) : (
        <p className="text-body-sm">{t["drill.flowDay.nobodyLeft"]}</p>
      )}
      <p className="mt-1 text-body-sm text-ink/80">{t["insights.flow.places"]}</p>
    </>
  );
}
