// The month overview beside the week (issue 300), from 640 px only: six Monday-to-Sunday rows, each day a
// link to its week, with up to three of its entries as text (server time) and how many more. Below 640 px
// the week list is the calendar.
import type { MonthCell } from "./calendar-data";

export function MonthGrid({
  title,
  cells,
  weekdays,
  more,
}: {
  title: string;
  cells: MonthCell[];
  /** Mon … Sun in the officer's language. */
  weekdays: string[];
  /** "+{n} more". */
  more: string;
}) {
  return (
    <section aria-label={title} className="mt-5 hidden sm:block">
      <h2 className="font-subhead text-display-sm capitalize">{title}</h2>
      <div className="mt-2 grid grid-cols-7 gap-0.5 text-[12px] leading-4">
        {weekdays.map((w) => (
          <span key={w} aria-hidden="true" className="pb-1 text-center font-semibold text-ink/70">
            {w}
          </span>
        ))}
        {cells.map((c) => (
          <a
            key={c.day}
            href={c.href}
            aria-label={c.said}
            aria-current={c.today ? "date" : undefined}
            className={`flex min-h-20 min-w-0 flex-col gap-0.5 border p-1 ${
              c.today ? "border-plum border-2" : "border-rule"
            } ${c.inMonth ? "" : "opacity-60"}`}
          >
            <span className={`font-semibold tabular-nums ${c.today ? "text-plum" : ""}`}>
              {c.date}
            </span>
            {c.labels.map((label, i) => (
              <span key={i} aria-hidden="true" className="truncate">
                {label}
              </span>
            ))}
            {c.more > 0 && (
              <span aria-hidden="true" className="text-ink/70">
                {more.replace("{n}", String(c.more))}
              </span>
            )}
          </a>
        ))}
      </div>
    </section>
  );
}
