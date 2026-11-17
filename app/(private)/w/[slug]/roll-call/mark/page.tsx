// /w/[slug]/roll-call/mark (issue 298): one roll call, `?entry=&week=` for a Calendar entry's week or `?id=`
// for one added by hand. Its rows in the order they keep while marking, away members apart (D80), and an
// Elixir Scramble roll call over its team only. Reading this page writes nothing: a Calendar roll call is
// stored with its first mark.
import { notFound } from "next/navigation";

import { fill } from "@/lib/copy";
import { callView } from "@/lib/private/roll-call-view";
import { callTitle } from "@/lib/private/roll-call-words";

import { calendarWords } from "../../../../_ui/calendar-data";
import { SignedInFrame } from "../../../../_ui/Frame";
import {
  headerOf,
  markRows,
  markWords,
  occasionQuery,
  rollWords,
} from "../../../../_ui/roll-call-data";
import { occasionOf, openRollCall } from "../../../../_ui/roll-call-page";
import { RollCallHead } from "../../../../_ui/RollCallHead";
import { RollCallMarks } from "../../../../_ui/RollCallMarks";

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
    (db, access, _today, lang, zone) => callView(db, access, occasion, lang, zone),
  );
  const view = page.data;
  if (!view) notFound();
  const { access, slug, t, language } = page;
  const o = view.opened;
  const elixir = o.kind === "elixir" && o.placed !== null;
  const head = headerOf(o, { t, language, zone: page.zone });
  return (
    <SignedInFrame access={access} language={language} t={t} current="mark" waiting={page.waiting}>
      <RollCallHead
        t={t}
        times={calendarWords(t)}
        backHref={`/w/${slug}/roll-call?week=${o.week}`}
        title={callTitle(o, t)}
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
        <RollCallMarks
          slug={slug}
          occasion={occasion}
          rows={markRows(view.rows, { t, language })}
          words={rollWords(t)}
          marks={markWords(o.kind, t)}
          shield={o.kind === "shield"}
          language={language}
          today={page.today}
        />
      )}
    </SignedInFrame>
  );
}
