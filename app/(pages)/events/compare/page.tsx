// `/events/compare?a=<event>&b=<event>[&alliance=<union_id> | &player=<uid>]`: event vs event (D57, issue
// 177; the player view, issue 199). Without `b` it compares the home event; without `a`, the newest event
// with data before it. An id that is not a public event, or an alliance or player in neither event, is a
// 404. With both `alliance` and `player`, the player view is shown and `alliance` is ignored.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { compareHref, ComparePicker } from "@/app/_ui/ComparePicker";
import { CompareTotals } from "@/app/_ui/CompareTotals";
import { EmptyState } from "@/app/_ui/EmptyState";
import { AllianceCompareCard, CompareHeader, eventHead } from "@/app/_ui/EventCompare";
import { ExactToggle } from "@/app/_ui/ExactToggle";
import { allianceLabel, type Clock } from "@/app/_ui/format";
import { requestClock, requestCopy } from "@/app/_ui/locale";
import { MemberCompareCard } from "@/app/_ui/MemberCompare";
import { PlayerCompareCard, PlayerCompareTitle } from "@/app/_ui/PlayerCompare";
import { ShowFirst } from "@/app/_ui/ShowFirst";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { Legend } from "@/app/_ui/Status";
import { fill, type Dictionary } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import {
  getComparePage,
  getComparePlayerPage,
  type AllianceComparison,
  type EventComparison,
  type PlayerComparison,
} from "@/lib/queries";

/** The members view lists this many by Might; "Show all" opens the rest, as the alliance page does. */
const TOP_MEMBERS = 20;

type Search = Promise<Record<string, string | string[] | undefined>>;

/** A missing parameter is null; a present one that is not an id is `undefined` (a 404). */
const idOf = (raw: string | string[] | undefined) => {
  if (raw === undefined) return null;
  return typeof raw === "string" && /^\d{1,9}$/.test(raw) ? Number(raw) : undefined;
};

/** `player` takes the player page's rule: real uids have 12 digits. */
const uidOf = (raw: string | string[] | undefined) => {
  if (raw === undefined) return null;
  return typeof raw === "string" && /^\d{1,15}$/.test(raw) ? Number(raw) : undefined;
};

const load = cache((a: number | null, b: number | null, unionId: number | null) =>
  withPageDb((db) => getComparePage(db, { a, b, unionId })),
);

const loadPlayer = cache((a: number | null, b: number | null, uid: number) =>
  withPageDb((db) => getComparePlayerPage(db, { a, b, uid })),
);

/** The page's data: the player view when `player` is given, else the alliances (or one alliance). */
async function read(searchParams: Search) {
  const sp = await searchParams;
  const [a, b, unionId, uid] = [idOf(sp.a), idOf(sp.b), idOf(sp.alliance), uidOf(sp.player)];
  if (a === undefined || b === undefined || unionId === undefined || uid === undefined) return null;
  if (uid !== null) {
    const page = await loadPlayer(a, b, uid);
    if (!page.found) return null;
    return { ...page, comparison: null, player: page.comparison, unionId: null, uid };
  }
  const page = await load(a, b, unionId);
  return page.found ? { ...page, player: null, unionId, uid: null } : null;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Search;
}): Promise<Metadata> {
  const [page, clock, copy] = await Promise.all([
    read(searchParams),
    requestClock(),
    requestCopy(),
  ]);
  const c = page?.comparison ?? page?.player;
  const title = c
    ? fill(copy.compare.versus, { a: eventHead(c.a, c.b, clock), b: eventHead(c.b, c.a, clock) })
    : copy.compare.title;
  const name = page?.player ? `${page.player.player.name} · ` : "";
  return { title: `${name}${title} · ${copy.site.name}` };
}

/** The `*` legend item only when a card carries the mark. */
const anyMemberMark = (c: EventComparison) =>
  c.alliances.some((r) =>
    [r.a, r.b].some(
      (f) => f?.change && (f.members.left ?? 0) > 0 && (f.change.power < 0 || f.change.kills < 0),
    ),
  );

/** The legend, the server's totals (the list only), the alliance cards and, for one alliance, its members. */
function Results({
  c,
  one,
  clock,
  copy,
}: {
  c: EventComparison;
  one: boolean;
  clock: Clock;
  copy: Dictionary;
}) {
  const l = copy.ledger;
  return (
    <>
      <Legend memberMark={anyMemberMark(c)} copy={copy} />
      {!one && <CompareTotals data={c} clock={clock} copy={copy} />}
      <CompareHeader lead={l.alliance} columns={[l.might, l.kills, l.members]} />
      <ul>
        {c.alliances.map((r) => (
          <AllianceCompareCard
            key={r.unionId}
            r={r}
            data={c}
            linked={!one}
            clock={clock}
            copy={copy}
          />
        ))}
      </ul>
      {one && c.members && (
        <section className="mt-6">
          <h2 className="mb-3 font-subhead text-display-md">{l.members}</h2>
          <CompareHeader lead={l.member} columns={[l.might, l.kills]} />
          <ShowFirst top={TOP_MEMBERS}>
            {c.members.map((m) => (
              <MemberCompareCard key={m.uid} m={m} data={c} clock={clock} copy={copy} />
            ))}
          </ShowFirst>
        </section>
      )}
    </>
  );
}

/** The player view (issue 199): the legend and the one player card. */
function PlayerResults({
  p,
  clock,
  copy,
}: {
  p: PlayerComparison;
  clock: Clock;
  copy: Dictionary;
}) {
  const l = copy.ledger;
  return (
    <>
      <Legend copy={copy} />
      <CompareHeader lead={l.player} columns={[l.might, l.kills]} />
      <ul>
        <PlayerCompareCard data={p} clock={clock} copy={copy} />
      </ul>
    </>
  );
}

/** The title: the player's photo and name, the alliance's label, or the page's name. */
function TitleRow({
  one,
  player,
  copy,
}: {
  one: AllianceComparison | undefined;
  player: PlayerComparison | null;
  copy: Dictionary;
}) {
  return (
    <div className="mb-1 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      {player ? (
        <PlayerCompareTitle p={player.player} />
      ) : (
        <h1 className="min-w-0 break-words font-display text-display-lg leading-tight">
          {one ? allianceLabel(one.tag, one.name) : copy.compare.title}
        </h1>
      )}
      <ExactToggle />
    </div>
  );
}

export default async function ComparePage({ searchParams }: { searchParams: Search }) {
  const page = await read(searchParams);
  if (!page) notFound();
  const [clock, copy] = await Promise.all([requestClock(), requestCopy()]);
  const { comparison: c, player, unionId } = page;
  const one = unionId !== null ? c?.alliances[0] : undefined;
  return (
    <>
      <SiteHeader
        events={page.events}
        currentId={null}
        homeId={page.homeId}
        clock={clock}
        copy={copy}
      />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        {one && (
          <Breadcrumbs
            crumbs={[
              { key: "compare", href: compareHref(page.a, page.b), label: copy.compare.title },
              { key: "alliance", label: allianceLabel(one.tag, one.name) },
            ]}
          />
        )}
        <TitleRow one={one} player={player} copy={copy} />
        <p className="mb-3 text-body-sm text-ink/70">{copy.compare.lead}</p>
        <ComparePicker
          choices={page.choices}
          a={page.a}
          b={page.b}
          unionId={unionId}
          uid={page.uid}
          clock={clock}
          copy={copy}
        />
        {!c && !player && (
          <EmptyState>
            {page.a !== null && page.a === page.b ? copy.compare.same : copy.compare.onlyOne}
          </EmptyState>
        )}
        {c && <Results c={c} one={one !== undefined} clock={clock} copy={copy} />}
        {player && <PlayerResults p={player} clock={clock} copy={copy} />}
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
