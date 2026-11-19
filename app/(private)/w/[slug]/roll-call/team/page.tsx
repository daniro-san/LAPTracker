// /w/[slug]/roll-call/team (issue 298): an Elixir Scramble team, `?entry=&week=` of its Calendar entry. Up
// to 20 players, suggested by who is awake at the window, then this week's daily quest points, then main squad might
// (owner, issue 298). Quest points stay on the server (D76): the page gets the order and "Quests this week".
import { notFound } from "next/navigation";

import { fill } from "@/lib/copy";
import { cardFormats } from "@/lib/private/member-card";
import { teamView } from "@/lib/private/roll-call-view";
import { callTitle } from "@/lib/private/roll-call-words";

import { calendarWords } from "../../../../_ui/calendar-data";
import { SignedInFrame } from "../../../../_ui/Frame";
import {
  headerOf,
  occasionQuery,
  registrationText,
  rollWords,
  teamRows,
} from "../../../../_ui/roll-call-data";
import { occasionOf, openRollCall } from "../../../../_ui/roll-call-page";
import { RollCallHead } from "../../../../_ui/RollCallHead";
import { TeamPicker } from "../../../../_ui/TeamPicker";

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const occasion = occasionOf(await searchParams);
  if (!occasion || "id" in occasion) notFound();
  const query = occasionQuery(occasion);
  const page = await openRollCall(
    params,
    `roll-call/team?${query}`,
    async (db, access, _today, lang, zone) => teamView(db, access, occasion, lang, zone),
  );
  const view = page.data;
  if (!view) return page.off ?? notFound();
  const { access, slug, t, language } = page;
  const o = view.opened;
  const f = cardFormats(language, page.zone, page.now);
  const plural = new Intl.PluralRules(language).select(view.away) === "one" ? "one" : "other";
  return (
    <SignedInFrame access={access} language={language} t={t} current="mark" waiting={page.waiting}>
      <RollCallHead
        t={t}
        times={calendarWords(t)}
        backHref={`/w/${slug}/roll-call?week=${o.week}`}
        title={callTitle(o, t)}
        {...headerOf(o, { t, language, zone: page.zone })}
        day={o.day}
        steps={{
          team: `/w/${slug}/roll-call/team?${query}`,
          call: `/w/${slug}/roll-call/mark?${query}`,
          open: "team",
        }}
      />
      <TeamPicker
        slug={slug}
        occasion={occasion}
        team={o.variant ?? ""}
        rows={teamRows(view.rows, t, f.compact)}
        registration={registrationText(o.day, page.today, t)}
        away={view.away === 0 ? null : fill(t[`roll.team.away.${plural}`], { n: view.away })}
        words={rollWords(t)}
      />
    </SignedInFrame>
  );
}
