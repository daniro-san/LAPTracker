// The Insights page's sections (issue 489), server-rendered: one drawn card per section, each opening with
// what it rests on, then HTML bars (D68: hand-built, the label and the number in HTML beside every bar,
// token colours, nothing hover-only). A missing number is the NoData mark, never 0 (D75). The only names
// are the "Quiet contributors" thanks list, in name order, with "Share the thanks" (D114).
import type { ReactNode } from "react";

import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import type { BarRow, InsightsWords, PulseMetricWords } from "@/lib/private/insights-words";

import { withNoData } from "./NoData";
import type { ShareThanksProps } from "./share-thanks-data";
import { ShareThanks } from "./ShareThanks";

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

/**
 * Horizontal bars: label and number on one line, the bar under them, a muted note after the number.
 * `bare`: a row with no share draws no empty track.
 */
export function Bars({
  rows,
  noData,
  tone = "plum",
  bare = false,
}: {
  rows: BarRow[];
  noData: string;
  tone?: "plum" | "ink";
  bare?: boolean;
}) {
  return (
    <ul className="mt-1">
      {rows.map((r, i) => (
        <li key={i} className={`border-t border-rule py-1.5 ${r.current ? "font-semibold" : ""}`}>
          <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-body-sm">
            <span className="min-w-0">{r.label}</span>
            <span className="whitespace-nowrap tabular-nums">
              {withNoData(r.value, noData)}
              {r.note && <span className="ml-2 font-normal text-ink/70">{r.note}</span>}
            </span>
          </p>
          {!(bare && r.share === null) && (
            <span aria-hidden="true" className="mt-1 block h-2 w-full bg-ink/10">
              {r.share !== null && (
                <span
                  className={`block h-2 ${tone === "plum" ? "bg-plum/60" : "bg-ink/45"}`}
                  style={{ width: `${Math.round(Math.max(0, Math.min(1, r.share)) * 100)}%` }}
                />
              )}
            </span>
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
        <li
          key={d.weekday}
          className="min-w-0"
          aria-label={d.later ? undefined : `${d.weekday}: ${d.value}`}
        >
          <span aria-hidden="true" className="block text-[12px] leading-4 text-ink/70">
            {d.weekday}
          </span>
          <span aria-hidden="true" className="flex h-8 items-end justify-center">
            {d.share !== null && (
              <span
                className="block w-full max-w-6 rounded-t-sm bg-plum/60"
                style={{ height: `${Math.max(6, Math.round(d.share * 100))}%` }}
              />
            )}
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

export function EffortCard(props: {
  effort: NonNullable<InsightsWords["effort"]>;
  t: WorkspaceDictionary;
  noData: string;
  share: ShareThanksProps | null;
}) {
  const { effort, t, noData } = props;
  // With too few reads the based lines say so: no groups and no names.
  if (!effort.groups[0]?.rows.length)
    return <Card id="insights-effort" title={t["insights.effort.head"]} based={effort.based} />;
  return (
    <Card id="insights-effort" title={t["insights.effort.head"]} based={effort.based}>
      <p className="mt-2 text-body-sm">{t["insights.effort.lead"]}</p>
      {effort.groups.map((g) => (
        <div key={g.label}>
          <Sub>{g.label}</Sub>
          <Bars rows={g.rows} noData={noData} />
        </div>
      ))}
      <div className="mt-4 border-t-2 border-rule pt-2">
        <h3 className="font-semibold">{t["insights.quiet.head"]}</h3>
        <p className="text-body-sm text-ink/80">{t["insights.quiet.lead"]}</p>
        {effort.quiet.length > 0 ? (
          <ul className="mt-1 text-body-sm">
            {effort.quiet.map((q) => (
              <li key={q.uid} className="border-t border-rule py-2">
                <bdi translate="no" className="font-semibold">
                  {q.name}
                </bdi>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-body-sm">{t["insights.quiet.none"]}</p>
        )}
        {props.share && effort.quiet.length > 0 && <ShareThanks {...props.share} />}
      </div>
    </Card>
  );
}

export function FlowCard({
  flow,
  t,
  noData,
}: {
  flow: NonNullable<InsightsWords["flow"]>;
  t: WorkspaceDictionary;
  noData: string;
}) {
  const joinedAny = flow.came.length > 0;
  const leftAny = flow.went.length > 0;
  return (
    <Card id="insights-flow" title={t["insights.flow.head"]} based={[flow.based]}>
      <Sub>{t["insights.flow.weeks"]}</Sub>
      <ul className="mt-1">
        {flow.weeks.map((w) => (
          <li key={w.label} className="border-t border-rule py-1.5">
            <p className="text-body-sm font-semibold">{w.label}</p>
            <div className="grid grid-cols-2 gap-x-3">
              <Bars rows={[w.joined]} noData={noData} />
              <Bars rows={[w.left]} noData={noData} tone="ink" />
            </div>
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
      <Bars rows={flow.tenure} noData={noData} />
      <Sub>{t["insights.newcomers.head"]}</Sub>
      {flow.newcomers.map((line) => (
        <p key={line} className="text-body-sm">
          {line}
        </p>
      ))}
    </Card>
  );
}
