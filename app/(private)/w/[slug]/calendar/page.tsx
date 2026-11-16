// /w/[slug]/calendar (issue 300): the leadership's week, day by day, with every time in server time (ST)
// and on the officer's own clock, and from 640 px the month around it. Any R4 or R5 adds, changes, moves
// and deletes entries (D71: one level of access). `?week=` is any day of the week shown.
import { calendarDays } from "@/lib/private/calendar";
import { addDays, mondayOf, weekDays } from "@/lib/private/calendar-time";
import { calendarDates } from "@/lib/private/calendar-words";

import { agendaWeek, calendarWords, monthCells } from "../../../_ui/calendar-data";
import { openCalendar } from "../../../_ui/calendar-page";
import { CalendarAgenda } from "../../../_ui/CalendarAgenda";
import { CalendarNav } from "../../../_ui/CalendarNav";
import { CalendarWeekBar } from "../../../_ui/CalendarWeekBar";
import { SignedInFrame } from "../../../_ui/Frame";
import { MonthGrid } from "../../../_ui/MonthGrid";

/** The first day of the month grid that holds `monday`, and its last (six whole weeks). */
const gridOf = (monday: string) => {
  const from = mondayOf(`${monday.slice(0, 8)}01`);
  return { from, to: addDays(from, 41) };
};

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await openCalendar(params, searchParams, (db, access, monday) => {
    const grid = gridOf(monday);
    return calendarDays(db, access, grid.from, grid.to);
  });
  const { access, slug, monday, today, ctx } = page;
  const { t, language } = ctx;
  const sunday = addDays(monday, 6);
  const week = page.data.filter((p) => p.day >= monday && p.day <= sunday);
  const { days, theme } = agendaWeek(week, monday, today, ctx);
  const month = monthCells(page.data, monday, today, slug, ctx);
  const href = (w: string) => `/w/${slug}/calendar?week=${w}`;
  return (
    <SignedInFrame access={access} language={language} t={t} current="days">
      <h1 className="font-display text-display-lg">{t["tab.days"]}</h1>
      <CalendarNav slug={slug} current="week" t={t} query={`?week=${monday}`} />
      <CalendarWeekBar
        href={href}
        monday={monday}
        thisWeek={page.thisWeek}
        t={t}
        language={language}
        offset={page.offset}
      />
      <MonthGrid
        title={month.title}
        cells={month.cells}
        weekdays={weekDays(monday).map(calendarDates(language).weekday)}
        more={t["calendar.month.more"]}
      />
      <CalendarAgenda
        days={days}
        theme={theme}
        words={calendarWords(t)}
        slug={slug}
        zone={ctx.zone}
        addDay={today >= monday && today <= sunday ? today : monday}
      />
    </SignedInFrame>
  );
}
