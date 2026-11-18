// /w/[slug]/roll-call (issue 298): the week's roll calls, one card each: the Calendar's KvK (shield),
// Undead Siege, Cheese Trap and Elixir Scramble teams, and those added by hand. Each card says
// its counts, where "not set" is only that (D75), and opens the marking page; an Elixir Scramble card also
// opens its team. `?week=` takes any day of the week shown, as on the Calendar.
import { Fragment } from "react";

import { isDay, mondayOf, offsetLabel } from "@/lib/private/calendar-time";
import { weekItems } from "@/lib/private/roll-call-view";

import { AddRollCall } from "../../../_ui/AddRollCall";
import { calendarWords, type CalendarSheetWords } from "../../../_ui/calendar-data";
import { CalendarWeekBar } from "../../../_ui/CalendarWeekBar";
import { SignedInFrame } from "../../../_ui/Frame";
import { rollCard, rollWords, type RollCard } from "../../../_ui/roll-call-data";
import { openRollCall } from "../../../_ui/roll-call-page";
import { Times } from "../../../_ui/YourTime";

const LINK =
  "inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4";

/** The counts, each kept whole on one line; the line breaks only between them. */
function Counts({ parts }: { parts: string[] }) {
  return (
    <p className="text-body-sm text-ink/80">
      {parts.map((p, i) => (
        <Fragment key={p}>
          {/* The separator stays outside the unit, so the line can break at its spaces. */}
          {i > 0 && " · "}
          <span className="whitespace-nowrap">{p}</span>
        </Fragment>
      ))}
    </p>
  );
}

function Card({ c, words }: { c: RollCard; words: CalendarSheetWords }) {
  return (
    <li className="drawn-card mt-4 px-4 py-3">
      <p className="text-body-sm">
        {c.dayLabel}
        {c.st && c.at !== null && (
          <>
            {" · "}
            <Times st={c.st} at={c.at} day={c.day} words={words} />
          </>
        )}
      </p>
      <h2 className="font-subhead text-display-sm">{c.title}</h2>
      {c.team && (
        <p className="text-body-sm">
          <span className="font-semibold">{c.team}</span>
          {c.registration && <span className="text-ink/80">{` · ${c.registration}`}</span>}
        </p>
      )}
      {c.counts && <Counts parts={c.counts} />}
      <p className="flex flex-wrap gap-x-5">
        {c.teamHref && (
          <a href={c.teamHref} className={LINK}>
            {words["calendar.pickTeam"]}
          </a>
        )}
        <a href={c.markHref} className={LINK}>
          {words["calendar.rollCall"]}
        </a>
      </p>
    </li>
  );
}

export default async function RollCallPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const asked = (await searchParams).week;
  const week = typeof asked === "string" && isDay(asked) ? asked : null;
  const page = await openRollCall(
    params,
    `roll-call${week ? `?week=${week}` : ""}`,
    (db, access, today, _language, zone) => weekItems(db, access, mondayOf(week ?? today), zone),
  );
  const { access, slug, t, language, today } = page;
  const monday = mondayOf(week ?? today);
  const ctx = { t, language, zone: page.zone };
  const cards = page.data.map((item) => rollCard(item, slug, today, ctx));
  const words = rollWords(t);
  const times = calendarWords(t);
  const day = monday === mondayOf(today) ? today : monday;
  return (
    <SignedInFrame access={access} language={language} t={t} current="mark" waiting={page.waiting}>
      <h1 className="font-display text-display-lg">{t["tab.mark"]}</h1>
      <p className="mt-1 text-body-sm">{t["roll.intro"]}</p>
      <CalendarWeekBar
        href={(w) => `/w/${slug}/roll-call?week=${w}`}
        monday={monday}
        thisWeek={mondayOf(today)}
        t={t}
        language={language}
        offset={offsetLabel(page.zone, page.now.getTime())}
      />
      {cards.length === 0 ? (
        <p className="drawn-card mt-4 px-4 py-3">{t["roll.none"]}</p>
      ) : (
        <ul>
          {cards.map((c) => (
            <Card key={c.key} c={c} words={times} />
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        <AddRollCall slug={slug} day={day} words={words} />
        <a href={`/w/${slug}/calendar?week=${monday}`} className={LINK}>
          {t["tab.days"]}
        </a>
      </div>
    </SignedInFrame>
  );
}
