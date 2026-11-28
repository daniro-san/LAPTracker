// /w/[slug]/recruit[?q=] (issue 833): the recruit check, a view of Members. An officer enters a player's name
// or ID and sees public facts from what is stored: alliance moves, name changes, might and kills over 30 days,
// and the events the player was seen in. A name lists the stored players it finds; an ID not stored yet
// offers one read from the tracker on the alliance's own key (RecruitRead). No score, no ranking, no judging
// words, and a value not known is left out (D75). The access check runs before anything is read (D71); turned
// off for the alliance, the page goes to Home (D126). Nothing is posted.
import type { ReactNode } from "react";

import { Button } from "@/lib/brand/components/Button";
import { FIELD } from "@/lib/brand/components/controls";
import { PageHead } from "@/lib/brand/components/layout/PageHead";
import { dateWords } from "@/lib/date-words";
import { getEnv } from "@/lib/env";
import type { WorkspaceDictionary } from "@/lib/private/dictionary";
import { compact } from "@/lib/private/insights-format";
import {
  recruitBudget,
  recruitFacts,
  recruitMatches,
  UID_TEXT,
  type RecruitAlliance,
  type RecruitFacts,
} from "@/lib/private/recruit-check";
import { fill } from "@/lib/words";
import { RECRUIT_READS_A_DAY } from "@/lib/workspace-features";

import { SignedInFrame } from "../../../_ui/Frame";
import { ViewSwitch } from "../../../_ui/MembersHead";
import { RecruitRead } from "../../../_ui/RecruitRead";
import { openRollCall } from "../../../_ui/roll-call-page";

type Search = Promise<Record<string, string | string[] | undefined>>;

/** At most this many characters are looked up: longer than any player name. */
const Q_MAX = 40;

type Format = { t: WorkspaceDictionary; language: string; zone: string };
type Matches = Awaited<ReturnType<typeof recruitMatches>>;
type Budget = Awaited<ReturnType<typeof recruitBudget>>;

const allianceText = (a: RecruitAlliance, t: WorkspaceDictionary) =>
  a.tag ?? fill(t["recruit.allianceId"], { id: a.unionId });

/** "Might: 12.3M → 13.1M", or "Might: 12.3M" when the 30 days hold one value. */
function spanLine(
  span: NonNullable<RecruitFacts["might"]>,
  keys: { two: "recruit.might" | "recruit.kills"; one: "recruit.mightOne" | "recruit.killsOne" },
  f: Format,
) {
  const n = (v: number) => compact(v, f.language);
  return span.from.at.getTime() === span.to.at.getTime()
    ? fill(f.t[keys.one], { value: n(span.to.value) })
    : fill(f.t[keys.two], { from: n(span.from.value), to: n(span.to.value) });
}

/** A titled list of facts; nothing when there is none (D75). */
function FactList({ title, items }: { title: string; items: { key: string; text: ReactNode }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="font-semibold">{title}</h3>
      <ul>
        {items.map((i) => (
          <li key={i.key} className="break-words">
            {i.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Facts({ facts, f }: { facts: RecruitFacts; f: Format }) {
  const { t } = f;
  const d = dateWords(f.language, f.zone);
  const { might, kills } = facts;
  const range = might ?? kills;
  const change = (at: Date, from: string, to: string) => ({
    key: `${at.getTime()}`,
    text: fill(t["recruit.change"], { date: d.day(at), from, to }),
  });
  return (
    <section className="mt-4" aria-labelledby="recruit-name">
      <h2 id="recruit-name" className="font-display text-display-sm break-words">
        <bdi>{facts.name ?? fill(t["recruit.unnamed"], { uid: facts.uid })}</bdi>
      </h2>
      {facts.alliance && (
        <p className="mt-1">
          {fill(t["recruit.alliance"], { tag: allianceText(facts.alliance, t) })}
        </p>
      )}
      <p className="mt-1 text-body-sm text-ink/70">
        {fill(t["recruit.asOf"], { time: d.at(facts.asOf) })}
      </p>
      {range && (
        <div className="mt-4">
          <h3 className="font-semibold">{t["recruit.month"]}</h3>
          {might && (
            <p className="tabular-nums">
              {spanLine(might, { two: "recruit.might", one: "recruit.mightOne" }, f)}
            </p>
          )}
          {kills && (
            <p className="tabular-nums">
              {spanLine(kills, { two: "recruit.kills", one: "recruit.killsOne" }, f)}
            </p>
          )}
          <p className="text-body-sm text-ink/70">
            {fill(t["recruit.between"], { from: d.day(range.from.at), to: d.day(range.to.at) })}
          </p>
        </div>
      )}
      <FactList
        title={t["recruit.moves"]}
        items={facts.moves.map((m) => change(m.at, allianceText(m.from, t), allianceText(m.to, t)))}
      />
      <FactList
        title={t["recruit.renames"]}
        items={facts.renames.map((r) => change(r.at, r.from, r.to))}
      />
      <FactList
        title={fill(t["recruit.events"], { n: facts.events.length })}
        items={facts.events.map((e) => ({
          key: `${e.id}`,
          text: [e.name, d.day(e.at), e.tag].filter(Boolean).join(" · "),
        }))}
      />
    </section>
  );
}

function SearchForm({ slug, q, t }: { slug: string; q: string; t: WorkspaceDictionary }) {
  return (
    <form method="get" action={`/w/${slug}/recruit`} className="mt-4">
      <label htmlFor="recruit-q" className="font-medium">
        {t["recruit.label"]}
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          id="recruit-q"
          name="q"
          type="search"
          defaultValue={q}
          maxLength={Q_MAX}
          autoComplete="off"
          className={`${FIELD} min-w-0 flex-1 text-[16px]`}
        />
        <Button type="submit">{t["recruit.search"]}</Button>
      </div>
    </form>
  );
}

/** The stored players a name finds, each a link to its facts. */
function MatchList({
  slug,
  matches,
  t,
}: {
  slug: string;
  matches: Matches;
  t: WorkspaceDictionary;
}) {
  if (matches.length === 0) return <p className="mt-4">{t["recruit.noMatch"]}</p>;
  return (
    <section className="mt-4" aria-labelledby="recruit-matches">
      <h2 id="recruit-matches" className="font-semibold">
        {t["recruit.matches"]}
      </h2>
      <ul>
        {matches.map((m) => (
          <li key={m.uid}>
            <a
              href={`/w/${slug}/recruit?q=${m.uid}`}
              className="inline-flex min-h-11 items-center gap-2 break-words underline underline-offset-4"
            >
              <bdi>{m.name}</bdi>
              {m.tag && <span className="text-ink/70">· {m.tag}</span>}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** An ID the stores do not hold: the read button with today's reads left, or why there is none. */
function NotStored(props: { slug: string; uid: number; budget: Budget; t: WorkspaceDictionary }) {
  const { budget, t } = props;
  const cap = RECRUIT_READS_A_DAY;
  const capReached = fill(t["recruit.capReached"], { cap });
  const why = !budget.key ? t["recruit.noKey"] : budget.left === 0 ? capReached : null;
  return (
    <section className="mt-4">
      <p>{t["recruit.notStored"]}</p>
      {why ? (
        <p className="mt-2 text-body-sm">{why}</p>
      ) : (
        <>
          <p className="mt-2 text-body-sm text-ink/80">
            {fill(t["recruit.readHelp"], { left: budget.left, cap })}
          </p>
          <RecruitRead
            slug={props.slug}
            uid={props.uid}
            words={{
              read: t["recruit.read"],
              capReached,
              notFound: t["recruit.notFound"],
              noKey: t["recruit.noKey"],
              failed: t["recruit.failed"],
            }}
          />
        </>
      )}
    </section>
  );
}

export default async function RecruitPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Search;
}) {
  const raw = (await searchParams).q;
  const q = (typeof raw === "string" ? raw : "").trim().slice(0, Q_MAX);
  const uid = UID_TEXT.test(q) ? Number(q) : null;
  const page = await openRollCall(
    params,
    "recruit",
    async (db, access) => {
      const now = new Date();
      if (uid === null) {
        const matches = q ? await recruitMatches(db, access, q, now) : null;
        return { facts: null, budget: null, matches };
      }
      const facts = await recruitFacts(db, access, uid, now);
      const secret = getEnv().WORKSPACE_KEYS_SECRET;
      const budget = facts ? null : await recruitBudget(db, access, secret, now);
      return { facts, budget, matches: null };
    },
    "recruit_check",
  );
  const { access, slug, t, language, data, waiting } = page;
  return (
    <SignedInFrame access={access} language={language} t={t} current="recruit" waiting={waiting}>
      <PageHead title={t["members.view.recruit"]} />
      <ViewSwitch slug={slug} open="recruit" on={access.features.on} t={t} />
      <p className="mt-2 text-body-sm text-ink/80">{t["recruit.lead"]}</p>
      <SearchForm slug={slug} q={q} t={t} />
      {data.matches && <MatchList slug={slug} matches={data.matches} t={t} />}
      {data.facts && <Facts facts={data.facts} f={{ t, language, zone: page.zone }} />}
      {uid !== null && data.budget && (
        <NotStored slug={slug} uid={uid} budget={data.budget} t={t} />
      )}
    </SignedInFrame>
  );
}
