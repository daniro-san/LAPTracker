// The week a Calendar view shows (issue 300): its Monday-to-Sunday range, the weeks before and after, and
// back to this week; then once per screen what ST means (owner: members keep asking "is this server
// time?") and what KvK stands for (naming.md).
import { fill } from "@/lib/copy";
import { addDays } from "@/lib/private/calendar-time";
import { calendarDates } from "@/lib/private/calendar-words";
import type { WorkspaceDictionary, WorkspaceLanguage } from "@/lib/private/dictionary";

const LINK =
  "inline-flex min-h-11 min-w-11 items-center justify-center border border-rule px-3 text-body-sm font-semibold";

export function CalendarWeekBar(props: {
  href: (week: string) => string;
  monday: string;
  thisWeek: string;
  t: WorkspaceDictionary;
  language: WorkspaceLanguage;
  offset: string;
}) {
  const { t, monday } = props;
  const dates = calendarDates(props.language);
  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a href={props.href(addDays(monday, -7))} aria-label={t["calendar.prev"]} className={LINK}>
          <span aria-hidden="true">‹</span>
        </a>
        <h2 className="min-w-0 flex-1 text-center font-subhead text-display-sm">
          {fill(t["calendar.week"], {
            from: dates.dayMonth(monday),
            to: dates.dayMonth(addDays(monday, 6)),
          })}
        </h2>
        <a href={props.href(addDays(monday, 7))} aria-label={t["calendar.next"]} className={LINK}>
          <span aria-hidden="true">›</span>
        </a>
      </div>
      {monday !== props.thisWeek && (
        <p className="mt-1 text-center">
          <a
            href={props.href(props.thisWeek)}
            className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
          >
            {t["calendar.thisWeek"]}
          </a>
        </p>
      )}
      <p className="mt-2 text-body-sm text-ink/80">
        {fill(t["calendar.legend"], { offset: props.offset })} {t["calendar.kvk"]}
      </p>
    </>
  );
}
