// /w/[slug]/roll-call/mark (issue 298): one roll call, `?entry=&week=` for a Calendar entry's week or `?id=`
// for one added by hand. Its rows in the order they keep while marking, away members apart (D80), and an
// Elixir Scramble roll call over its team only. Reading this page writes nothing: a Calendar roll call is
// stored with its first mark. A saved roll call can be archived or deleted at the foot (D120); a deleted
// one is a 404 here. A Raid Shield roll call is Raid prep (D137): two marks per member and the tracker's
// shield readings while the Raid Shield check is on.
import { notFound } from "next/navigation";

import { fill } from "@/lib/copy";
import type { Db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import type { WorkspaceAccess } from "@/lib/private/access";
import { webhookViews } from "@/lib/private/discord-webhooks";
import { prepView } from "@/lib/private/raid-prep";
import type { Occasion } from "@/lib/private/roll-call";
import { callView } from "@/lib/private/roll-call-view";
import { callTitle } from "@/lib/private/roll-call-words";

import { calendarWords } from "../../../../_ui/calendar-data";
import { SignedInFrame } from "../../../../_ui/Frame";
import { prepHead, prepRows } from "../../../../_ui/prep-data";
import { RaidPrepMarks } from "../../../../_ui/RaidPrepMarks";
import {
  headerOf,
  markRows,
  markWords,
  occasionQuery,
  rollWords,
} from "../../../../_ui/roll-call-data";
import { occasionOf, openRollCall } from "../../../../_ui/roll-call-page";
import { RollCallHead } from "../../../../_ui/RollCallHead";
import { RollCallManage } from "../../../../_ui/RollCallManage";
import { RollCallMarks } from "../../../../_ui/RollCallMarks";

/** The roll call's rows, and Raid prep's part for a Raid Shield roll call (D137). */
async function readMark(
  db: Db,
  access: WorkspaceAccess,
  occasion: Occasion,
  lang: string,
  zone: string,
) {
  const call = await callView(db, access, occasion, lang, zone);
  if (call?.opened.kind !== "shield") return call && { ...call, prep: null };
  // The summary posts only through a saved Raid Shield channel the master key opens (D147).
  const hooks = await webhookViews(db, access, getEnv());
  const shieldChannel = hooks.some((h) => h.channel === "shield" && h.state === "set");
  const prep = await prepView(db, access, call.opened, { zone, now: new Date(), shieldChannel });
  return { ...call, prep };
}

type Page = Awaited<ReturnType<typeof openRollCall<Awaited<ReturnType<typeof readMark>>>>>;

/** The rows: Raid prep's two marks for a Raid Shield roll call (D137), else the roll call's one. */
function Marks(props: { view: NonNullable<Page["data"]>; page: Page; occasion: Occasion }) {
  const { view, page, occasion } = props;
  const { slug, t, language } = page;
  const o = view.opened;
  const common = {
    slug,
    occasion,
    rows: markRows(view.rows, { t, language }),
    words: rollWords(t),
    marks: markWords(o.kind, t),
    language,
    today: page.today,
  };
  if (!view.prep) return <RollCallMarks {...common} shield={o.kind === "shield"} />;
  return (
    <RaidPrepMarks
      {...common}
      prep={prepRows(view.prep, t, page.zone)}
      head={prepHead(view.prep, t, page.zone)}
    />
  );
}

export default async function MarkPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const occasion = occasionOf(await searchParams);
  if (!occasion) notFound();
  const query = occasionQuery(occasion);
  const page = await openRollCall(
    params,
    `roll-call/mark?${query}`,
    (db, access, _today, lang, zone) => readMark(db, access, occasion, lang, zone),
  );
  const view = page.data;
  if (!view) notFound();
  const { access, slug, t, language } = page;
  const o = view.opened;
  const elixir = o.kind === "elixir" && o.placed !== null;
  const head = headerOf(o, { t, language, zone: page.zone });
  const words = rollWords(t);
  const title = callTitle(o, t);
  return (
    // Raid prep is laid out for the wide frame: four columns of tiles at 1280 (issue 585, D122).
    <SignedInFrame
      access={access}
      language={language}
      t={t}
      current="mark"
      waiting={page.waiting}
      wide={view.prep !== null}
    >
      <RollCallHead
        t={t}
        times={calendarWords(t)}
        backHref={`/w/${slug}/roll-call?week=${o.week}`}
        title={title}
        archived={!!o.call?.archivedAt}
        {...head}
        day={o.day}
        steps={
          elixir
            ? {
                team: `/w/${slug}/roll-call/team?${query}`,
                call: `/w/${slug}/roll-call/mark?${query}`,
                open: "call",
              }
            : null
        }
      />
      {view.team === 0 ? (
        <p className="mt-4 border-t border-rule py-3">
          {fill(t["roll.teamEmpty"], { team: o.variant ?? "" })}{" "}
          <a
            href={`/w/${slug}/roll-call/team?${query}`}
            className="inline-flex min-h-11 items-center font-semibold text-plum underline underline-offset-4"
          >
            {t["roll.pickTeam"]}
          </a>
        </p>
      ) : (
        <Marks view={view} page={page} occasion={occasion} />
      )}
      {o.call && (
        <RollCallManage
          slug={slug}
          id={o.call.id}
          title={title}
          dayLabel={head.dayLabel}
          week={o.week}
          calendar={o.placed !== null}
          archived={o.call.archivedAt !== null}
          words={words}
        />
      )}
    </SignedInFrame>
  );
}
