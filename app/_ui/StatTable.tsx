// One data shape, two layouts (plan Phase 5): a card per row below 640 px, a table row at ≥ 640 px.
// Plain markup and Tailwind, no client code: the member table wraps it in a client component that
// sorts and filters. A row with `href` is tappable as a whole (stretched link); `detail` opens on tap.
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

import { Delta, Num } from "./Num";

export interface StatMetric {
  label: string;
  value: number | null;
  /** The earlier value this one is compared with (before → after). */
  from?: number | null;
  delta: number | null;
  /** The delta's percentage is relative to this; defaults to `from`. */
  base?: number | null;
  note?: string;
  /** A second change shown under the first, e.g. the change since the previous event. */
  vs?: { label: string; delta: number | null; base: number | null };
}

export interface StatRow {
  key: string;
  href?: string;
  lead: ReactNode;
  sub?: ReactNode;
  metrics: StatMetric[];
  /** Always visible inside the "tap for more" bar, e.g. freshness dots. */
  summary?: ReactNode;
  detail?: ReactNode;
}

const MUTED = "text-zinc-500 dark:text-zinc-400";

function MetricCell({ m }: { m: StatMetric }) {
  const base = m.base ?? m.from ?? null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 sm:block sm:text-right">
      <span className={`w-20 shrink-0 text-xs uppercase tracking-wide sm:hidden ${MUTED}`}>
        {m.label}
      </span>
      <span className="font-medium tabular-nums">
        <Num n={m.value} />
      </span>
      <span className="tabular-nums text-sm sm:block">
        <Delta delta={m.delta} base={base} note={m.note} />
      </span>
      {m.vs && (
        <span className={`text-xs tabular-nums ${MUTED} sm:block`}>
          {m.vs.label}: <Delta delta={m.vs.delta} base={m.vs.base} />
        </span>
      )}
      {m.from !== undefined && m.from !== null && m.from !== m.value && (
        <span className={`text-xs tabular-nums ${MUTED} sm:block`}>
          Before event: <Num n={m.from} />
        </span>
      )}
    </div>
  );
}

function Lead({ row }: { row: StatRow }) {
  return (
    <div className="min-w-0 break-words [overflow-wrap:anywhere]">
      {row.href ? (
        <Link
          href={row.href}
          className="font-semibold after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline"
        >
          {row.lead}
        </Link>
      ) : (
        <span className="font-semibold">{row.lead}</span>
      )}
      {row.sub && <div className={`text-sm ${MUTED}`}>{row.sub}</div>}
    </div>
  );
}

function MoreBar({ row }: { row: StatRow }) {
  if (!row.summary && !row.detail) return null;
  return (
    <details className="relative z-10 col-span-full">
      <summary className="flex min-h-11 cursor-pointer items-center gap-3 text-sm [&::-webkit-details-marker]:hidden">
        {row.summary}
        {row.detail && <span className={`ml-auto ${MUTED}`}>About this data ▾</span>}
      </summary>
      {row.detail && <div className="pb-2 text-sm">{row.detail}</div>}
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
  if (rows.length === 0)
    return <p className={`py-6 text-center ${MUTED}`}>{empty ?? "Nothing here."}</p>;
  const grid = {
    "--cols": `minmax(0,2.4fr) repeat(${columns.length}, minmax(0,1fr))`,
  } as CSSProperties;
  return (
    <div>
      <div
        className={`hidden border-b border-zinc-300 px-3 pb-1 text-xs uppercase tracking-wide sm:grid sm:grid-cols-[var(--cols)] sm:gap-x-3 dark:border-zinc-700 ${MUTED}`}
        style={grid}
        aria-hidden="true"
      >
        <span>{leadLabel}</span>
        {columns.map((c) => (
          <span key={c} className="text-right">
            {c}
          </span>
        ))}
      </div>
      <ul>
        {rows.map((row) => (
          <li
            key={row.key}
            style={grid}
            className="relative mb-3 grid grid-cols-1 gap-y-1 border border-zinc-300 p-3 sm:mb-0 sm:grid-cols-[var(--cols)] sm:gap-x-3 sm:border-0 sm:border-b sm:py-2 dark:border-zinc-700"
          >
            <Lead row={row} />
            {row.metrics.map((m) => (
              <MetricCell key={m.label} m={m} />
            ))}
            <MoreBar row={row} />
          </li>
        ))}
      </ul>
    </div>
  );
}
