// The Insights page's sections (issue 489), server-rendered: one drawn card per section, each opening with
// what it rests on, then HTML bars (D68: hand-built, the label and the number in HTML beside every bar,
// token colours, nothing hover-only). A missing number is the NoData mark, never 0 (D75). A count that
// stands for a set of members opens its names (issue 678), in name order with nothing beside a name. The effort
// card is in InsightsEffort.tsx.
import type { ReactNode } from "react";

import { Bar } from "@/app/_ui/charts/Bar";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { BarRow, InsightsWords, PulseMetricWords } from "@/lib/private/insights-words";
import { fill } from "@/lib/words";

import { Caret, membersHref, Names, SetFold, SetRow, TapHint } from "./InsightsSets";
import { withNoData } from "./NoData";

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
        <span className="min-w-0">{r.label}</span>
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
}: {
  rows: BarRow[];
  noData: string;
  tone?: "plum" | "ink";
  /** Where a row's set opens its names: the workspace's address and its words. */
  sets?: { slug: string; t: WorkspaceDictionary };
}) {
  return (
    <ul className="mt-1">
      {rows.map((r, i) => (
        <li
          key={i}
          className={`border-t border-rule ${r.set && sets ? "" : "py-1.5"} ${r.current ? "font-semibold" : ""}`}
        >
          {r.set && sets ? (
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

/** This week's seven days, one column each: the bar, a hairline, the number under it. */
function Days({ metric, noData }: { metric: PulseMetricWords; noData: string }) {
  return (
    <ol className="mt-2 grid grid-cols-7 gap-0.5 text-center">
      {metric.days.map((d) => (
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

export function Sub({ children }: { children: ReactNode }) {
  return <h3 className="mt-3 text-body-sm font-semibold">{children}</h3>;
}

export function PulseCard({
  pulse,
  t,
  noData,
}: {
  pulse: NonNullable<InsightsWords["pulse"]>;
  t: WorkspaceDictionary;
  noData: string;
}) {
  return (
    <Card id="insights-pulse" title={t["insights.pulse.head"]} based={pulse.based}>
      {pulse.metrics.map((m) => (
        <div key={m.label} className="mt-3 border-t-2 border-rule pt-2">
          <h3 className="font-semibold">{m.label}</h3>
          <p className="text-body-sm tabular-nums">{withNoData(m.latest, noData)}</p>
          <Days metric={m} noData={noData} />
          <p className="mt-2 text-[12px] font-semibold text-ink/70 uppercase">
            {t["insights.pulse.weeks"]}
          </p>
          <Bars rows={m.weeks} noData={noData} />
        </div>
      ))}
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
      far={w.joined.set ? membersHref(slug, w.joined.set) : null}
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

export function FlowCard({
  flow,
  t,
  noData,
  slug,
}: {
  flow: NonNullable<InsightsWords["flow"]>;
  t: WorkspaceDictionary;
  noData: string;
  slug: string;
}) {
  const joinedAny = flow.came.length > 0;
  const leftAny = flow.went.length > 0;
  return (
    <Card id="insights-flow" title={t["insights.flow.head"]} based={[flow.based]}>
      <Sub>{t["insights.flow.weeks"]}</Sub>
      <TapHint t={t} />
      <ul className="mt-1">
        {flow.weeks.map((w, i) => (
          <li key={w.label} className="border-t border-rule">
            <WeekRow w={w} i={i} t={t} noData={noData} slug={slug} />
          </li>
        ))}
      </ul>
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
