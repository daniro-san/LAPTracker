// The members' board's week strip (D116), out of BoardSections.tsx for its length: the seven days with a
// dot per event, and under them the legend that says what the dots are (issue 585).
import type { BoardEntry } from "@/lib/private/board";
import { calendarDates } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";
import { fill, plural } from "@/lib/words";

/**
 * The seven days as a strip (D116): weekday and date, a dot per event (three at most) and the count for
 * screen readers. A day with events jumps to its card; today is filled plum. Days with nothing planned stay
 * quiet, never empty boxes to fill. With an event in the week, a legend under it says what a dot is.
 */
export function Strip(props: {
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  today: string;
  days: { day: string; items: BoardEntry[] }[];
}) {
  const { t, language, today } = props;
  const dates = calendarDates(language);
  const number = new Intl.DateTimeFormat(language, { day: "numeric", timeZone: "UTC" });
  return (
    <>
      <ol aria-label={t["board.days"]} className="mt-3 grid grid-cols-7 gap-0.5">
        {props.days.map(({ day, items }) => {
          const n = items.length;
          const now = day === today;
          const look = now ? "bg-plum text-paper" : n > 0 ? "bg-plum/10 text-plum" : "text-ink/70";
          const said = `${dates.long(day)}${now ? ` · ${t["board.today"]}` : ""} · ${
            n > 0
              ? fill(
                  plural(
                    n,
                    { one: t["board.events.one"], other: t["board.events.other"] },
                    language,
                  ),
                  { n },
                )
              : t["board.free"]
          }`;
          const inside = (
            <>
              <span aria-hidden="true" className="text-[12px] leading-tight">
                {dates.weekday(day)}
              </span>
              <span aria-hidden="true" className="text-lg leading-tight font-semibold tabular-nums">
                {number.format(new Date(`${day}T00:00:00Z`))}
              </span>
              <span aria-hidden="true" className="flex h-2 gap-0.5">
                {Array.from({ length: Math.min(n, 3) }, (_, i) => (
                  <span
                    key={i}
                    className={`size-1.5 rounded-full ${now ? "bg-paper" : "bg-plum"}`}
                  />
                ))}
              </span>
              <span className="sr-only">{said}</span>
            </>
          );
          const box = `flex min-h-16 flex-col items-center justify-center gap-0.5 px-0.5 ${look}`;
          return (
            <li key={day}>
              {n > 0 ? (
                <a href={`#day-${day}`} className={`${box} tint-button underline-offset-4`}>
                  {inside}
                </a>
              ) : (
                <span className={box}>{inside}</span>
              )}
            </li>
          );
        })}
      </ol>
      {props.days.some((d) => d.items.length > 0) && (
        <p className="mt-2 flex items-baseline gap-2 text-body-sm text-ink/75">
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 translate-y-[-0.15em] rounded-full bg-plum"
          />
          <span>{t["board.strip.legend"]}</span>
        </p>
      )}
    </>
  );
}
