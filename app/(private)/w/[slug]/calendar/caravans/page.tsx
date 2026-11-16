// /w/[slug]/calendar/caravans (issue 300): the week's Alliance Caravans and their picks, one Coachman plus a
// VIP or a Guardian, from the alliance's own newest roster (D71: only its own members). `?week=` as on Week.
import { calendarDays, pickableMembers } from "@/lib/private/calendar";
import { addDays } from "@/lib/private/calendar-time";

import { agendaItem, calendarWords } from "../../../../_ui/calendar-data";
import { openCalendar } from "../../../../_ui/calendar-page";
import { CalendarNav } from "../../../../_ui/CalendarNav";
import { CalendarWeekBar } from "../../../../_ui/CalendarWeekBar";
import { CaravanBoard } from "../../../../_ui/CaravanBoard";
import { SignedInFrame } from "../../../../_ui/Frame";

export default async function CaravansPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const page = await openCalendar(params, searchParams, async (db, access, monday) => {
    const [days, roster] = await Promise.all([
      calendarDays(db, access, monday, addDays(monday, 6)),
      pickableMembers(db, access),
    ]);
    return { days, roster };
  });
  const { access, slug, monday, ctx } = page;
  const { t, language } = ctx;
  const caravans = page.data.days
    .filter((p) => p.entry.kind === "caravan")
    .map((p) => agendaItem(p, ctx));
  // Name order, not might order: the picker is not a ranking (D75).
  const roster = [...page.data.roster].sort((a, b) => a.name.localeCompare(b.name, language));
  return (
    <SignedInFrame access={access} language={language} t={t} current="days">
      <h1 className="font-display text-display-lg">{t["tab.days"]}</h1>
      <CalendarNav slug={slug} current="caravans" t={t} query={`?week=${monday}`} />
      <CalendarWeekBar
        href={(w) => `/w/${slug}/calendar/caravans?week=${w}`}
        monday={monday}
        thisWeek={page.thisWeek}
        t={t}
        language={language}
        offset={page.offset}
      />
      <CaravanBoard items={caravans} roster={roster} words={calendarWords(t)} slug={slug} />
      {caravans.length === 0 && (
        <p className="mt-2">
          <a
            href={`/w/${slug}/calendar?week=${monday}`}
            className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
          >
            {t["calendar.caravans.add"]}
          </a>
        </p>
      )}
    </SignedInFrame>
  );
}
