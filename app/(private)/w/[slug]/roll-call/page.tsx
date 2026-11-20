// /w/[slug]/roll-call (issue 298): the week's roll calls, one card each: the Calendar's KvK (shield),
// Undead Siege, Cheese Trap and Elixir Scramble teams, and those added by hand. Each card says
// its counts, where "not set" is only that (D75), and opens the marking page; an Elixir Scramble card also
// opens its team. `?week=` takes any day of the week shown, as on the Calendar. An archived roll call
// leaves the week and shows under `?archived=1`, the newest first; after a delete the week says "Roll call
// deleted." with Undo (D120).
import { Fragment } from "react";

import { chip } from "@/lib/brand/components/controls";
import { fill } from "@/lib/copy";
import type { Db } from "@/lib/db";
import type { WorkspaceAccess } from "@/lib/private/access";
import { isDay, mondayOf, offsetLabel } from "@/lib/private/calendar-time";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { archivedInWeek, archivedItems, weekItems } from "@/lib/private/roll-call-view";

import { AddRollCall } from "../../../_ui/AddRollCall";
import { calendarWords, type CalendarSheetWords } from "../../../_ui/calendar-data";
import { CalendarWeekBar } from "../../../_ui/CalendarWeekBar";
import { SignedInFrame } from "../../../_ui/Frame";
import { rollCard, rollWords, type RollCard } from "../../../_ui/roll-call-data";
import { openRollCall } from "../../../_ui/roll-call-page";
import { RollCallDeletedLine } from "../../../_ui/RollCallManage";
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

/** Active (the week's) or Archived roll calls, as two links. */
function Filter(props: {
  slug: string;
  monday: string;
  archived: boolean;
  t: WorkspaceDictionary;
}) {
  const { slug, t } = props;
  const links = [
    { on: !props.archived, href: `/w/${slug}/roll-call?week=${props.monday}`, key: "week" },
    { on: props.archived, href: `/w/${slug}/roll-call?archived=1`, key: "archived" },
  ] as const;
  return (
    <nav aria-label={t["roll.filter.aria"]} className="mt-3 flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.key}
          href={l.href}
          aria-current={l.on ? "page" : undefined}
          className={`${chip(l.on)} justify-center`}
        >
          {t[`roll.filter.${l.key}`]}
        </a>
      ))}
    </nav>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Search = Record<string, string | string[] | undefined>;

/** Just deleted (D120): ?deleted=<id>&undo=<the delete's request id> shows the line with Undo. */
function justDeleted({ deleted, undo }: Search) {
  return typeof deleted === "string" &&
    /^[1-9]\d{0,8}$/.test(deleted) &&
    typeof undo === "string" &&
    UUID.test(undo)
    ? { id: Number(deleted), requestId: undo }
    : null;
}

/**
 * The Archived list, or the week from the Monday of `day` with how many of its roll calls are archived (so
 * an officer does not add again what they archived, D120).
 */
async function listOf(
  db: Db,
  access: WorkspaceAccess,
  zone: string,
  archived: boolean,
  day: string,
) {
  if (archived) return { items: await archivedItems(db, access, zone), archivedHere: 0 };
  const [items, archivedHere] = await Promise.all([
    weekItems(db, access, mondayOf(day), zone),
    archivedInWeek(db, access, mondayOf(day)),
  ]);
  return { items, archivedHere };
}

/** "2 archived roll calls this week ›", to the Archived list; nothing when none is. */
function ArchivedHint({ slug, n, t }: { slug: string; n: number; t: WorkspaceDictionary }) {
  if (n === 0) return null;
  return (
    <p className="mt-3">
      <a href={`/w/${slug}/roll-call?archived=1`} className={LINK}>
        {fill(t[n === 1 ? "roll.archived.week.one" : "roll.archived.week.other"], { n })}
      </a>
    </p>
  );
}

/** The page's own path, for the return after sign-in (D99). */
const pathOf = (archived: boolean, week: string | null) =>
  archived ? "roll-call?archived=1" : `roll-call${week ? `?week=${week}` : ""}`;

export default async function RollCallPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const search = await searchParams;
  const asked = search.week;
  const week = typeof asked === "string" && isDay(asked) ? asked : null;
  const archived = search.archived === "1";
  const just = justDeleted(search);
  const page = await openRollCall(params, pathOf(archived, week), (db, access, today, _l, zone) =>
    listOf(db, access, zone, archived, week ?? today),
  );
  const { access, slug, t, language, today } = page;
  const monday = mondayOf(week ?? today);
  const ctx = { t, language, zone: page.zone };
  const cards = page.data.items.map((item) => rollCard(item, slug, today, ctx));
  const words = rollWords(t);
  const times = calendarWords(t);
  const day = monday === mondayOf(today) ? today : monday;
  return (
    <SignedInFrame access={access} language={language} t={t} current="mark" waiting={page.waiting}>
      <h1 className="font-display text-display-lg">{t["tab.mark"]}</h1>
      <p className="mt-1 text-body-sm">{t["roll.intro"]}</p>
      <Filter slug={slug} monday={monday} archived={archived} t={t} />
      {!archived && (
        <CalendarWeekBar
          href={(w) => `/w/${slug}/roll-call?week=${w}`}
          monday={monday}
          thisWeek={mondayOf(today)}
          t={t}
          language={language}
          offset={offsetLabel(page.zone, page.now.getTime())}
        />
      )}
      {just && <RollCallDeletedLine key={just.requestId} slug={slug} {...just} words={words} />}
      {cards.length === 0 ? (
        <p className="drawn-card mt-4 px-4 py-3">
          {t[archived ? "roll.archived.none" : "roll.none"]}
        </p>
      ) : (
        <ul>
          {cards.map((c) => (
            <Card key={c.key} c={c} words={times} />
          ))}
        </ul>
      )}
      <ArchivedHint slug={slug} n={page.data.archivedHere} t={t} />
      {!archived && (
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
          <AddRollCall slug={slug} day={day} words={words} />
          <a href={`/w/${slug}/calendar?week=${monday}`} className={LINK}>
            {t["tab.days"]}
          </a>
        </div>
      )}
    </SignedInFrame>
  );
}
