// The member card's "Last 7 days" (issue 461, D136): daily quest points, Alliance Help coins and donations
// per server day as small HTML bars (D68: hand-built, labels and numbers in HTML beside every bar, colours
// from tokens, nothing hover-only). Coins are drawn against their 1,000 cap; the other two against the
// row's own highest day, since the number under each bar says the amount. A day with no read is the NoData
// mark, never 0; "none" (the read listed them, nothing sent, D127) is a muted word with no bar.
import type { DaysCard, DaysRow } from "@/lib/private/member-days";

import { withNoData } from "./NoData";

export function MemberLastDays({ days }: { days: DaysCard }) {
  return (
    <section className="mt-3">
      {days.head && <h3 className="text-body-sm font-semibold">{days.head}</h3>}
      {/* The days once, over the three rows; each bar also says its own date to screen readers. */}
      <ol
        aria-hidden="true"
        className="mt-1 grid grid-cols-7 gap-0.5 text-center text-[12px] leading-4 text-ink/70"
      >
        {days.days.map((d) => (
          <li key={`${d.weekday}${d.day}`}>
            <span className="block whitespace-nowrap">{d.weekday}</span>
            <span className="block tabular-nums">{d.day}</span>
          </li>
        ))}
      </ol>
      {days.rows.map((row) => (
        <Row key={row.metric} row={row} noData={days.noData} />
      ))}
      {days.might && <p className="mt-2 text-body-sm tabular-nums">{days.might}</p>}
    </section>
  );
}

function Row({ row, noData }: { row: DaysRow; noData: string }) {
  return (
    <div className="mt-2 border-t border-rule pt-1.5">
      <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-body-sm">
        <span>{row.label}</span>
        <span className="text-[12px] text-ink/70 tabular-nums">
          {withNoData(row.average, noData)}
        </span>
      </p>
      {row.last && <p className="text-[12px] text-ink/70 tabular-nums">{row.last}</p>}
      <ol className="mt-1 grid grid-cols-7 gap-0.5 text-center">
        {row.bars.map((b, i) => (
          <li key={i} aria-label={b.said} className="min-w-0">
            <span aria-hidden="true" className="flex h-8 items-end justify-center">
              {b.share !== null && (
                <span
                  className="block w-full max-w-6 rounded-t-sm bg-plum/60"
                  style={{ height: `${Math.max(6, Math.round(b.share * 100))}%` }}
                />
              )}
            </span>
            <span aria-hidden="true" className="block h-px bg-ink/50" />
            <span
              aria-hidden="true"
              className={`block truncate text-[12px] leading-5 tabular-nums ${b.none ? "text-ink/60" : ""}`}
            >
              {withNoData(b.value, noData)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
