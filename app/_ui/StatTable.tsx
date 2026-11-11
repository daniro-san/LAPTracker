// One row shape at three depths (DESIGN.md "Navigation and hierarchy"): alliances on the main page,
// members on the alliance page, events on the alliance and player pages. A card per row below 640 px,
// a table row at ≥ 640 px. The card is simple — rank, name, three numbers with their change — and the
// full figures open under "Details". Text hierarchy (DESIGN.md "Typography"): card title Alegreya Sans,
// labels small caps in ink/70, values Source Sans 500, changes coloured, notes and metadata ink/70.
import type { CSSProperties, ReactNode } from "react";

import { TextLink } from "@/lib/brand/components/TextLink";
import type { Dictionary } from "@/lib/copy";

import { EmptyState } from "./EmptyState";
import { Delta, Num, Rank } from "./Num";

export interface StatMetric {
  label: string;
  value: number | null;
  /** The earlier value this one is compared with (before → after). */
  from?: number | null;
  delta: number | null;
  /** There is nothing to compare with (one snapshot): no change line, not even `—`. */
  noChange?: boolean;
  /** The delta's percentage is relative to this; defaults to `from`. */
  base?: number | null;
  note?: string;
  /** The change fell while members left: it carries the `*` mark the legend explains. */
  memberMark?: boolean;
  /** Shown only in the row's Details panel, beside the before → after values. */
  detailNote?: string | undefined;
  /** The time these figures are from, shown where the change would be: a card whose After failed keeps
   * its Before figures and says when they were taken (UX review S3). */
  at?: string;
  /** A second change shown under the first, e.g. the change since the previous event. */
  vs?: { label: string; delta: number | null; base: number | null; memberMark?: boolean };
}

export interface StatRow {
  key: string;
  href?: string;
  /** A pale background class that marks the row (the alliance leader and officers), beside its mark. */
  tint?: string;
  /** The element id, for "jump to my alliance". */
  anchor?: string;
  /** `#n` and its movement (compute.rankDelta), before the picture; no `move`: only `#n`. */
  rank?: { n: number | null; move?: number | null };
  lead: ReactNode;
  /** A badge or photo before the lead (app/_ui/Pictures.tsx). */
  icon?: ReactNode;
  sub?: ReactNode;
  metrics: StatMetric[];
  /** Always visible beside the Details control, e.g. the freshness mark. */
  summary?: ReactNode;
  detail?: ReactNode;
}

const MUTED = "text-ink/70";
export const LABEL = `text-label font-semibold uppercase tracking-[0.04em] ${MUTED}`;

/** `shared`: the row's Details control sits on this metric's line below 640 px (see MoreBar), so the
 * metric takes one of the card's two columns; otherwise it spans both. */
function MetricCell({ m, shared }: { m: StatMetric; shared: boolean }) {
  const base = m.base ?? m.from ?? null;
  return (
    <div
      className={`grid grid-cols-[5rem_minmax(0,1fr)] items-baseline gap-x-2 sm:col-span-1 sm:block sm:text-right ${shared ? "" : "col-span-2"}`}
    >
      {/* sr-only at ≥ 640 px, where the column header shows it: a screen reader still hears it (07c S4). */}
      <span className={`${LABEL} sm:sr-only`}>{m.label}</span>
      <div className="flex flex-wrap items-baseline gap-x-2 sm:block">
        <span className="text-base font-medium tabular-nums">
          {m.from !== undefined && m.from !== null && m.from !== m.value && (
            <span className={`text-sm font-normal ${MUTED}`}>
              <Num n={m.from} /> →{" "}
            </span>
          )}
          <Num n={m.value} />
        </span>
        {m.at ? (
          <span className={`text-sm tabular-nums sm:block ${MUTED}`}>{m.at}</span>
        ) : (
          !m.noChange && (
            <span className="text-sm tabular-nums sm:block">
              <Delta delta={m.delta} base={base} note={m.note} memberMark={m.memberMark === true} />
            </span>
          )
        )}
        {m.vs && (
          <span className={`basis-full text-xs tabular-nums ${MUTED} sm:block`}>
            {m.vs.label}{" "}
            <Delta delta={m.vs.delta} base={m.vs.base} memberMark={m.vs.memberMark === true} />
          </span>
        )}
      </div>
    </div>
  );
}

/** The rank sits on the name's first baseline (issue 125); the picture is centred on that first line
 * (a box one name line tall), so a one-line lead keeps rank, picture and name on one centre line. The
 * picture overflows that box, so the row sets its own 44 px minimum (StatTable's `sm:min-h-11`). */
function Lead({ row }: { row: StatRow }) {
  return (
    <div className="col-span-2 flex min-w-0 items-baseline gap-2 border-b border-rule pb-2 sm:col-span-1 sm:border-0 sm:pb-0">
      {row.rank && (
        <span className="w-14 shrink-0 text-base">
          <Rank n={row.rank.n} move={row.rank.move} />
        </span>
      )}
      {row.icon && (
        <span className="flex h-[1lh] shrink-0 items-center self-start text-display-sm leading-tight">
          {row.icon}
        </span>
      )}
      <div className="min-w-0 break-words">
        {row.href ? (
          <TextLink stretch href={row.href} className="font-subhead text-display-sm leading-tight">
            {row.lead}
          </TextLink>
        ) : (
          <span className="font-subhead text-display-sm leading-tight">{row.lead}</span>
        )}
        {row.sub && <div className={`text-sm ${MUTED}`}>{row.sub}</div>}
      </div>
    </div>
  );
}

/** The Details control. `inline` (the StatTable rows): the control is a grid item of the row, a fifth
 * column at ≥ 640 px and the Members line's second cell below it, and its panel spans the row (the
 * `.stat-more` rules in app/globals.css; a browser without `::details-content` keeps it on its own line).
 * `inline="sm"` (the player's history rows, issue 125): the same from 640 px only, in the row's last
 * column on its first line; below 640 px the control keeps its own line.
 * The summary carries the row's name for screen readers (UX review S6). */
export function MoreBar({
  row,
  copy,
  inline = false,
}: {
  row: StatRow;
  copy: Dictionary;
  inline?: boolean | "sm";
}) {
  if (!row.summary && !row.detail) return null;
  const column = "sm:flex-col sm:items-end sm:justify-center sm:gap-0";
  const [box, bar] =
    inline === "sm"
      ? ["stat-more-sm", `sm:row-start-1 sm:[grid-column:-2/-1] ${column}`]
      : inline
        ? ["stat-more", `justify-end ${column}`]
        : ["", ""];
  return (
    <details className={`group/more relative z-10 col-span-full ${box}`}>
      <summary
        className={`details-bar relative z-10 flex min-h-11 items-center gap-3 text-sm [&::-webkit-details-marker]:hidden ${bar}`}
      >
        {row.summary}
        {row.detail && (
          <span className="drawn-frame-soft tint-button ml-auto inline-flex min-h-11 items-center gap-1 px-3 font-medium text-plum group-open/more:bg-plum/10">
            <span>
              {copy.ledger.details}
              {row.lead && <span className="sr-only">, {row.lead}</span>}
            </span>
            <span
              aria-hidden="true"
              className="transition-transform duration-150 group-open/more:rotate-180 motion-reduce:transition-none"
            >
              ▾
            </span>
          </span>
        )}
      </summary>
      {row.detail && (
        <div className="stat-more-panel relative z-10 col-span-full border-t border-rule pb-2 pt-2 text-sm">
          {row.detail}
        </div>
      )}
    </details>
  );
}

export function StatTable({
  leadLabel,
  columns,
  rows,
  empty,
  copy,
}: {
  leadLabel: string;
  columns: string[];
  rows: StatRow[];
  empty?: ReactNode;
  /** The request's words: the server's requestCopy or the client's useCopy. */
  copy: Dictionary;
}) {
  if (rows.length === 0) return <EmptyState>{empty ?? copy.empty.kettle}</EmptyState>;
  // At ≥ 640 px a fifth, fixed column holds the Details control, so the header and every row align.
  const more = rows.some((r) => r.summary || r.detail);
  const grid = {
    "--cols": `minmax(0,2.4fr) repeat(${columns.length}, minmax(0,1fr))${more ? " 6.75rem" : ""}`,
  } as CSSProperties;
  return (
    <div>
      {/* At ≥ 640 px the column names stay in view under the site header while the rows scroll
          (owner, 2026-11-05: "when I scroll down I can't see the headers"). It starts behind the
          header's lace so rows do not show through the lace's gaps. Cards carry their own labels. */}
      <div
        className={`sticky top-[calc(var(--site-header)-var(--lace))] z-20 hidden border-b border-rule bg-paper px-3 pb-1 pt-[calc(0.5rem+var(--lace))] sm:grid sm:grid-cols-[var(--cols)] sm:gap-x-3 ${LABEL}`}
        style={grid}
      >
        <span>{leadLabel}</span>
        {columns.map((c, i) => (
          <span key={i} className="text-right">
            {c}
          </span>
        ))}
      </div>
      <ul>
        {rows.map((row) => (
          <li
            key={row.key}
            id={row.anchor}
            style={grid}
            className={`stat-card relative mb-3 grid scroll-mt-20 grid-cols-1 gap-y-1.5 border border-rule p-3 data-[mine]:bg-yarn/5 data-[mine]:shadow-[inset_3px_0_0_var(--color-yarn)] sm:mb-0 sm:min-h-11 sm:grid-cols-[var(--cols)] sm:content-center sm:gap-x-3 sm:border-0 sm:border-b sm:py-2 ${row.tint ?? ""}`}
          >
            <Lead row={row} />
            {row.metrics.map((m, i) => (
              <MetricCell key={i} m={m} shared={i === row.metrics.length - 1 && more} />
            ))}
            <MoreBar row={row} copy={copy} inline />
          </li>
        ))}
      </ul>
    </div>
  );
}
