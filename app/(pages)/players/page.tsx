// `/players?q=`: search by current or earlier name (plan Phase 5d, §3.8). Every match is listed, names that
// start with the text first, each with its might and level, in a card grid from 768 px (issue 473).

import { allianceLabel, type Clock } from "@/app/_ui/format";
import { requestClock, requestCopy } from "@/app/_ui/locale";
import { Num } from "@/app/_ui/Num";
import { AllianceBadge, PlayerAvatar } from "@/app/_ui/Pictures";
import { PlayerSearch } from "@/app/_ui/PlayerSearch";
import { sharedEvents, sharedPlayerSearch } from "@/app/_ui/public-reads";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { LABEL } from "@/app/_ui/StatTable";
import { CardGrid } from "@/lib/brand/components/layout/CardGrid";
import { GrannyEmpty } from "@/lib/brand/components/Mascot";
import { TextLink } from "@/lib/brand/components/TextLink";
import { isolate, type Dictionary } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { homeEvent } from "@/lib/queries";
import { SEARCH_LIMIT, type PlayerMatch } from "@/lib/queries/player-search";
import { fill } from "@/lib/words";

const MAX_QUERY = 64;

export async function generateMetadata() {
  const copy = await requestCopy();
  return { title: `${copy.search.title} · ${copy.site.name}` };
}

/** One match: photo, name (and the earlier name that matched), alliance, when last seen, might and level. */
function MatchCard({ m, clock, copy }: { m: PlayerMatch; clock: Clock; copy: Dictionary }) {
  return (
    <li className="stat-card relative flex items-center gap-2 border border-rule p-3">
      <PlayerAvatar uid={m.uid} photo={m} />
      <div className="min-w-0 name-fit">
        <TextLink
          stretch
          href={`/players/${m.uid}`}
          className="font-subhead text-display-sm leading-tight"
        >
          <bdi>{m.name}</bdi>
        </TextLink>
        {m.matchedName && (
          <span className="block text-sm text-ink/70">
            {fill(copy.ledger.was, { name: isolate(m.matchedName) })}
          </span>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
          <AllianceBadge badgeId={m.badgeId} />
          {allianceLabel(m.tag, m.allianceName)}
          <span className="whitespace-nowrap text-ink/70">
            <span className={LABEL}>{copy.search.seen}</span> {clock.day(m.lastSeen)}
          </span>
        </div>
        <p className="mt-1 flex flex-wrap gap-x-4 text-sm tabular-nums">
          <span className="whitespace-nowrap">
            <span className={LABEL}>{copy.ledger.might}</span>{" "}
            <span className="font-medium">
              <Num n={m.power} />
            </span>
          </span>
          <span className="whitespace-nowrap">
            <span className={LABEL}>{copy.ledger.level}</span>{" "}
            <span className="font-medium">{m.lv ?? "—"}</span>
          </span>
        </p>
      </div>
    </li>
  );
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q: raw } = await searchParams;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, MAX_QUERY) ?? "";
  const [events, matches, clock, copy] = await Promise.all([
    sharedEvents(),
    // ILIKE: every case of one text finds the same players, so they share one entry.
    q === "" ? [] : sharedPlayerSearch(q.toLowerCase()),
    requestClock(),
    requestCopy(),
  ]);
  return (
    <>
      <SiteHeader
        events={events}
        currentId={null}
        homeId={homeEvent(events, new Date(), getEnv().SNAPSHOT_WINDOW_MIN)?.id ?? null}
        section="players"
        clock={clock}
        copy={copy}
      />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <h1 className="font-display text-display-lg leading-tight">{copy.search.title}</h1>
        <PlayerSearch q={q} maxLength={MAX_QUERY}>
          {q === "" && <p className="text-body-sm text-ink/70">{copy.search.hint}</p>}
          {matches.length > 0 && (
            <p className="mb-3 text-body-sm text-ink/70">
              {matches.length === SEARCH_LIMIT
                ? fill(copy.search.limit, { n: SEARCH_LIMIT })
                : fill(copy.search.results, { n: matches.length })}
            </p>
          )}
          {q !== "" && matches.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center">
              <GrannyEmpty className="w-40 text-plum" />
              <p className="mt-3 max-w-[32ch] font-subhead text-display-sm font-semibold">
                {copy.search.noMatch}
              </p>
            </div>
          )}
          <CardGrid list>
            {matches.map((m) => (
              <MatchCard key={m.uid} m={m} clock={clock} copy={copy} />
            ))}
          </CardGrid>
        </PlayerSearch>
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
