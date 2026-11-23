// The Insights page's sections (issue 489), server-rendered: one drawn card per section, each opening with
// what it rests on, then HTML bars (D68: hand-built, the label and the number in HTML beside every bar,
// token colours, nothing hover-only). A missing number is the NoData mark, never 0 (D75). A count that
// stands for a set of members opens its names (issue 678), in name order with nothing beside a name. A week row
// of the pulse or the flow opens that week's days in the chart's place (D158 rule 7 (b), InsightsDays.tsx).
// The effort card is in InsightsEffort.tsx.
import type { ReactNode } from "react";

import { Bar } from "@/app/_ui/charts/Bar";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import {
  levelHref,
  type FlowDaysWords,
  type InsightsLevels,
  type PulseDaysWords,
} from "@/lib/private/insights-days-words";
import type { BarRow, InsightsWords } from "@/lib/private/insights-words";
import { fill } from "@/lib/words";

import { Days, FlowDays, PulseDays } from "./InsightsDays";
import { InsightsDrillLink } from "./InsightsDrillLink";
import { Caret, membersHref, Names, SetFold, SetRow, TapHint } from "./InsightsSets";
import { withNoData } from "./NoData";

/** Where a chart's levels link: the Insights page's address and the levels it shows now. */
export interface LevelNav {
  base: string;
  levels: InsightsLevels;
}

const PULSE_CARD = "insights-pulse";
const FLOW_CARD = "insights-flow";

export function Card({
  id,
  title,
  based,
  children,
}: {
  id: string;
  title: string;
  based: string[];
  children?: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="drawn-card mt-4 px-4 py-3 first:mt-0">
      <h2 id={id} className="font-subhead text-display-sm">
        {title}
      </h2>
      {based.map((line) => (
        <p key={line} className="text-body-sm text-ink/80">
          {line}
        </p>
      ))}
      {children}
    </section>
  );
}

/** A bar row's label and number on one line, the bar under them; a set's count is plum with its ▾. */
function RowBody(props: {
  r: BarRow;
  noData: string;
  tone: "plum" | "ink";
  /** False where the fold's ▾ sits elsewhere (a flow week's, by its label). */
  caret?: boolean;
}) {
  const { r, noData, tone, caret = true } = props;
  return (
    <>
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
        <span className="min-w-0">
          {r.label}
          {r.drill && (
            <span aria-hidden="true" className="ml-1 text-plum">
              ›
            </span>
          )}
        </span>
        <span className="whitespace-nowrap tabular-nums">
          <span className={r.set ? "font-semibold text-plum" : undefined}>
            {withNoData(r.value, noData)}
          </span>
          {r.set && caret && <Caret />}
          {r.note && <span className="ml-2 font-normal text-ink/70">{r.note}</span>}
        </span>
      </span>
      <Bar
        axis="row"
        share={r.share}
        tone={tone === "plum" ? "bg-plum/60" : "bg-ink/45"}
        className="mt-1 h-2 w-full bg-ink/10"
      />
    </>
  );
}

/**
 * Horizontal bars: label and number on one line, the bar under them, a muted note after the number. A row
 * with no share draws no bar (D158). A row with a set opens its names under it (`slug` makes their links).
 */
export function Bars({
  rows,
  noData,
  tone = "plum",
  sets,
  drill,
}: {
  rows: BarRow[];
  noData: string;
  tone?: "plum" | "ink";
  /** Where a row's set opens its names: the workspace's address and its words. */
  sets?: { slug: string; t: WorkspaceDictionary };
  /** Where a row's week opens its days (D158 rule 7 (b)): the week's pulse. */
  drill?: LevelNav;
}) {
  return (
    <ul className="mt-1">
      {rows.map((r, i) => (
        <li
          key={i}
          className={`border-t border-rule ${(r.set && sets) || (r.drill && drill) ? "" : "py-1.5"} ${r.current ? "font-semibold" : ""}`}
        >
          {r.drill && drill ? (
            <InsightsDrillLink
              href={levelHref(drill.base, drill.levels, { pulse: r.drill.key }, PULSE_CARD)}
              kind="pulse_days"
              count={r.drill.count}
              className="tint-button block min-h-11 py-1.5"
            >
              <RowBody r={r} noData={noData} tone={tone} />
            </InsightsDrillLink>
          ) : r.set && sets ? (
            <SetRow
              set={r.set}
              slug={sets.slug}
              t={sets.t}
              label={r.set.title}
              summary={<RowBody r={r} noData={noData} tone={tone} />}
            />
          ) : (
            <RowBody r={r} noData={noData} tone={tone} />
          )}
        </li>
      ))}
    </ul>
  );
}

export function Sub({ children }: { children: ReactNode }) {
  return <h3 className="mt-3 text-body-sm font-semibold">{children}</h3>;
}

export function PulseCard({
  pulse,
  level,
  nav,
  t,
  noData,
}: {
  pulse: NonNullable<InsightsWords["pulse"]>;
  /** The week the address opens to its days, in the card's place; null for the card itself. */
  level: PulseDaysWords | null;
  nav: LevelNav;
  t: WorkspaceDictionary;
  noData: string;
}) {
  const top = levelHref(nav.base, nav.levels, { pulse: null }, PULSE_CARD);
  return (
    <Card id={PULSE_CARD} title={t["insights.pulse.head"]} based={level ? [] : pulse.based}>
      {level ? (
        <PulseDays level={level} top={top} t={t} noData={noData} />
      ) : (
        pulse.metrics.map((m) => (
          <div key={m.label} className="mt-3 border-t-2 border-rule pt-2">
            <h3 className="font-semibold">{m.label}</h3>
            <p className="text-body-sm tabular-nums">{withNoData(m.latest, noData)}</p>
            <Days days={m.days} noData={noData} />
            <p className="mt-2 text-[12px] font-semibold text-ink/70 uppercase">
              {t["insights.pulse.weeks"]}
            </p>
            <Bars rows={m.weeks} noData={noData} drill={nav} />
          </div>
        ))
      )}
    </Card>
  );
}

/** A week's label and its joined and left bars side by side; the count of a set that opens is plum. */
function WeekBars({ w, noData }: { w: FlowWeek; noData: string }) {
  return (
    <>
      <span className="block text-body-sm font-semibold">
        {w.label}
        {(w.joined.set || w.left.set) && <Caret />}
      </span>
      <span className="grid grid-cols-2 gap-x-3">
        {([w.joined, w.left] as const).map((r, i) => (
          <span key={i} className="block border-t border-rule py-1.5">
            <RowBody r={r} noData={noData} tone={i === 0 ? "plum" : "ink"} caret={false} />
          </span>
        ))}
      </span>
    </>
  );
}

type FlowWeek = NonNullable<InsightsWords["flow"]>["weeks"][number];

/** A week's row: one fold over its names at full width, joined then left (issue 678), or its bars alone. */
function WeekRow(props: {
  w: FlowWeek;
  i: number;
  t: WorkspaceDictionary;
  noData: string;
  slug: string;
}) {
  const { w, t, noData, slug } = props;
  if (!w.joined.set && !w.left.set)
    return (
      <div className="py-1.5">
        <WeekBars w={w} noData={noData} />
      </div>
    );
  return (
    <SetFold
      kind="flow_week"
      setKey={`week-${props.i}`}
      count={(w.joined.set?.people.length ?? 0) + (w.left.set?.people.length ?? 0)}
      title={`${t["insights.flow.weeks"]} · ${w.label}`}
      // Members lists the joiners only: past 60 the fold links there only when nobody left that week, so
      // the link holds exactly what the count counts; otherwise both lists open in the sheet.
      far={w.joined.set && !w.left.set ? membersHref(slug, w.joined.set) : null}
      summary={<WeekBars w={w} noData={noData} />}
      t={t}
    >
      {(
        [
          [w.joined.set, "insights.flow.joinedWho"],
          [w.left.set, "insights.flow.leftWho"],
        ] as const
      ).map(([set, key]) => {
        if (!set) return null;
        // "Joined (1)": a noun and the count, never the bar's "−1" over a name.
        const head = fill(t[key], { n: set.people.length });
        return (
          <div key={key}>
            <h4 className="text-body-sm font-semibold">{head}</h4>
            <Names set={set} slug={slug} label={`${w.label}: ${head}`} />
          </div>
        );
      })}
    </SetFold>
  );
}

/** The weeks, joined then left, each week with a join or a leave linking to its days under its row. */
function Weeks(props: {
  flow: NonNullable<InsightsWords["flow"]>;
  nav: LevelNav;
  t: WorkspaceDictionary;
  noData: string;
  slug: string;
}) {
  const { flow, nav, t, noData, slug } = props;
  return (
    <>
      <TapHint t={t} />
      <ul className="mt-1">
        {flow.weeks.map((w, i) => (
          <li key={w.label} className="border-t border-rule">
            <WeekRow w={w} i={i} t={t} noData={noData} slug={slug} />
            {w.drill && (
              <InsightsDrillLink
                href={levelHref(nav.base, nav.levels, { flow: w.drill.key }, FLOW_CARD)}
                kind="flow_days"
                count={w.drill.count}
                className="tint-button inline-flex min-h-11 items-center text-body-sm font-semibold text-plum underline"
              >
                {w.drill.label}
              </InsightsDrillLink>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function FlowCard({
  flow,
  level,
  nav,
  t,
  noData,
  slug,
}: {
  flow: NonNullable<InsightsWords["flow"]>;
  /** The week the address opens to its days, in the weeks' place; null for the weeks. */
  level: FlowDaysWords | null;
  nav: LevelNav;
  t: WorkspaceDictionary;
  noData: string;
  slug: string;
}) {
  const joinedAny = flow.came.length > 0;
  const leftAny = flow.went.length > 0;
  const top = levelHref(nav.base, nav.levels, { flow: null }, FLOW_CARD);
  return (
    <Card id={FLOW_CARD} title={t["insights.flow.head"]} based={[flow.based]}>
      <Sub>{level ? t["drill.flow.days"] : t["insights.flow.weeks"]}</Sub>
      {level ? (
        <FlowDays level={level} top={top} t={t} noData={noData} />
      ) : (
        <Weeks {...{ flow, nav, t, noData, slug }} />
      )}
      <Sub>{t["insights.flow.came"]}</Sub>
      {joinedAny ? (
        <Bars rows={flow.came} noData={noData} />
      ) : (
        <p className="text-body-sm">{t["insights.flow.nobodyJoined"]}</p>
      )}
      <Sub>{t["insights.flow.went"]}</Sub>
      {leftAny ? (
        <Bars rows={flow.went} noData={noData} tone="ink" />
      ) : (
        <p className="text-body-sm">{t["insights.flow.nobodyLeft"]}</p>
      )}
      {(joinedAny || leftAny) && (
        <p className="mt-1 text-body-sm text-ink/80">{t["insights.flow.places"]}</p>
      )}
      <Sub>{t["insights.tenure.head"]}</Sub>
      <p className="text-body-sm text-ink/80">{t["insights.tenure.based"]}</p>
      <Bars rows={flow.tenure} noData={noData} sets={{ slug, t }} />
      <Sub>{t["insights.newcomers.head"]}</Sub>
      {flow.newcomers.map((line) => (
        <p key={line} className="text-body-sm">
          {line}
        </p>
      ))}
    </Card>
  );
}
