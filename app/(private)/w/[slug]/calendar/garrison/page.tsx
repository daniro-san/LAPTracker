// /w/[slug]/calendar/garrison?entry=&week= (issue 423, D121): an Undead Siege's garrison plan, from its
// Calendar entry's week. The enemy might first (the threshold), then who needs help, who is close, who has
// no squad data, the spare squads, and the share bar. Officers only (requireWorkspace, D71); a member's
// session never reaches it.
import { notFound } from "next/navigation";

import { fill } from "@/lib/copy";
import { calendarDates, titleOf } from "@/lib/private/calendar-words";
import { garrisonView } from "@/lib/private/garrison";

import { calendarWords } from "../../../../_ui/calendar-data";
import { SignedInFrame } from "../../../../_ui/Frame";
import { boardData, garrisonWords } from "../../../../_ui/garrison-data";
import { GarrisonBoard } from "../../../../_ui/GarrisonBoard";
import { GarrisonEnemy } from "../../../../_ui/GarrisonEnemy";
import { occasionOf, openRollCall } from "../../../../_ui/roll-call-page";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

export default async function GarrisonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const occasion = occasionOf(await searchParams);
  if (!occasion || !("entry" in occasion)) notFound();
  const query = `entry=${occasion.entry}&week=${occasion.week}`;
  const page = await openRollCall(params, `calendar/garrison?${query}`, (db, access) =>
    garrisonView(db, access, occasion.entry, occasion.week),
  );
  if (!page.data) notFound();
  const { view } = page.data;
  const { access, slug, t, language } = page;
  const words = garrisonWords(t);
  const day = view.placed.day;
  const when = new Intl.DateTimeFormat(language, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: page.zone,
  });
  const posted = view.posted && fill(t["garrison.postedAt"], { when: when.format(view.posted) });
  return (
    <SignedInFrame access={access} language={language} t={t} current="days" waiting={page.waiting}>
      <p>
        <a href={`/w/${slug}/calendar?week=${view.placed.week}#d-${day}`} className={LINK}>
          {`‹ ${t["garrison.back"]}`}
        </a>
      </p>
      <h1 className="font-display text-display-lg">{t["garrison.title"]}</h1>
      <p className="text-body-sm">
        {`${titleOf(view.placed.entry, t)} · ${calendarDates(language).long(day)}`}
      </p>
      <p className="mt-2 text-body-sm">{t["garrison.intro"]}</p>
      <GarrisonEnemy
        slug={slug}
        entry={view.placed.entry.id}
        value={view.enemyMight}
        version={view.version}
        words={words}
        calendar={calendarWords(t)}
      />
      {view.enemyMight === null ? (
        <p className="mt-4 border-t border-rule py-3">{t["garrison.enemyNone"]}</p>
      ) : (
        <GarrisonBoard
          slug={slug}
          data={boardData(view, t, language)}
          words={words}
          posted={posted}
        />
      )}
    </SignedInFrame>
  );
}
