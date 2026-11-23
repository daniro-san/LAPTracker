// The Insights cards' shared parts (issue 489), server-rendered: the drawn card, its sub-heading, and its
// horizontal bars (D68: the label and the number in HTML beside every bar, token colours, nothing
// hover-only). A missing number is the NoData mark, never 0 (D75). A row with a set opens its names (issue
// 678); a pulse week's row opens its days in the chart's place (D158 rule 7 (b)).
import type { ReactNode } from "react";

import { Bar } from "@/app/_ui/charts/Bar";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { levelHref, type InsightsLevels } from "@/lib/private/insights-days-words";
import type { BarRow } from "@/lib/private/insights-words";

import { InsightsDrillLink } from "./InsightsDrillLink";
import { Caret, SetRow } from "./InsightsSets";
import { withNoData } from "./NoData";

/** Where a chart's levels link: the Insights page's address and the levels it shows now. */
export interface LevelNav {
  base: string;
  levels: InsightsLevels;
}

export const PULSE_CARD = "insights-pulse";
export const FLOW_CARD = "insights-flow";
export const KVK_CARD = "insights-kvk";

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
export function RowBody(props: {
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
