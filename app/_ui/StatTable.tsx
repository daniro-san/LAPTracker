// One row shape at three depths (DESIGN.md "Navigation and hierarchy"): alliances on the main page,
// members on the alliance page, events on the alliance and player pages. A card per row below 640 px,
// a table row at ≥ 640 px. The card is simple — rank, name, three numbers with their change — and the
// full figures open under "Details". Text hierarchy (DESIGN.md "Typography"): card title Alegreya Sans,
// labels small caps in ink/70, values Source Sans 500, changes coloured, notes and metadata ink/70.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { copy } from "@/lib/copy";

import { EmptyState } from "./EmptyState";
import { Delta, Num, Rank } from "./Num";

export interface StatMetric {
  label: string;
  value: number | null;
  /** The earlier value this one is compared with (before → after). */
  from?: number | null;
  delta: number | null;
  /** The delta's percentage is relative to this; defaults to `from`. */
  base?: number | null;
  note?: string;
  /** Shown only in the row's Details panel, beside the before → after values. */
  detailNote?: string | undefined;
  /** A second change shown under the first, e.g. the change since the previous event. */
  vs?: { label: string; delta: number | null; base: number | null };
}

export interface StatRow {
  key: string;
  href?: string;
  /** The element id, for "jump to my alliance". */
  anchor?: string;
  /** `#n` and its movement (compute.rankDelta), before the picture. */
  rank?: { n: number | null; move: number | null };
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

function MetricCell({ m }: { m: StatMetric }) {
  const base = m.base ?? m.from ?? null;
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-baseline gap-x-2 sm:block sm:text-right">
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
        <span className="text-sm tabular-nums sm:block">
          <Delta delta={m.delta} base={base} note={m.note} />
        </span>
        {m.vs && (
          <span className={`basis-full text-xs tabular-nums ${MUTED} sm:block`}>
            {m.vs.label} <Delta delta={m.vs.delta} base={m.vs.base} />
          </span>
        )}
      </div>
    </div>
  );
}

function Lead({ row }: { row: StatRow }) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-rule pb-2 sm:border-0 sm:pb-0">
      {row.rank && (
        <span className="w-14 shrink-0 text-base">
          <Rank n={row.rank.n} move={row.rank.move} />
        </span>
      )}
      {row.icon}
      <div className="min-w-0 break-words">
        {row.href ? (
          <Link
            href={row.href}
            className="font-subhead text-display-sm leading-tight text-plum after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline"
          >
            {row.lead}
          </Link>
        ) : (
          <span className="font-subhead text-display-sm leading-tight">{row.lead}</span>
        )}
        {row.sub && <div className={`text-sm ${MUTED}`}>{row.sub}</div>}
      </div>
    </div>
  );
}

export function MoreBar({ row }: { row: StatRow }) {
  if (!row.summary && !row.detail) return null;
  return (
    <details className="group/more relative z-10 col-span-full">
      <summary className="flex min-h-11 cursor-pointer items-center gap-3 text-sm [&::-webkit-details-marker]:hidden">
        {row.summary}
        {row.detail && (
          <span className="drawn-frame-soft ml-auto inline-flex min-h-11 items-center gap-1 px-3 font-medium text-plum group-open/more:bg-plum/10">
            {copy.ledger.details}
            <span
              aria-hidden="true"
              className="transition-transform duration-150 group-open/more:rotate-180 motion-reduce:transition-none"
            >
              ▾
            </span>
          </span>
        )}
      </summary>
      {row.detail && <div className="border-t border-rule pb-2 pt-2 text-sm">{row.detail}</div>}
    </details>
  );
}

export function StatTable({
  leadLabel,
  columns,
  rows,
  empty,
}: {
  leadLabel: string;
  columns: string[];
  rows: StatRow[];
  empty?: ReactNode;
}) {
  if (rows.length === 0) return <EmptyState>{empty ?? copy.empty.kettle}</EmptyState>;
  const grid = {
    "--cols": `minmax(0,2.4fr) repeat(${columns.length}, minmax(0,1fr))`,
  } as CSSProperties;
  return (
    <div>
      <div
        className={`hidden border-b border-rule px-3 pb-1 sm:grid sm:grid-cols-[var(--cols)] sm:gap-x-3 ${LABEL}`}
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
            className="stat-card relative mb-3 grid scroll-mt-20 grid-cols-1 gap-y-1.5 border border-rule p-3 data-[mine]:bg-yarn/15 sm:mb-0 sm:grid-cols-[var(--cols)] sm:gap-x-3 sm:border-0 sm:border-b sm:py-2"
          >
            <Lead row={row} />
            {row.metrics.map((m, i) => (
              <MetricCell key={i} m={m} />
            ))}
            <MoreBar row={row} />
          </li>
        ))}
      </ul>
    </div>
  );
}
