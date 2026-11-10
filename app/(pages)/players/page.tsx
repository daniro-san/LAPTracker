// `/players?q=`: search by current or earlier name (plan Phase 5d, §3.8). Every match is listed.
import Link from "next/link";

import { allianceLabel } from "@/app/_ui/format";
import { requestClock, requestCopy } from "@/app/_ui/locale";
import { AllianceBadge, PlayerAvatar } from "@/app/_ui/Pictures";
import { PlayerSearch } from "@/app/_ui/PlayerSearch";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { LABEL } from "@/app/_ui/StatTable";
import { GrannyEmpty } from "@/lib/brand/components/Mascot";
import { fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { homeEvent, listEvents } from "@/lib/queries";
import { searchPlayers, SEARCH_LIMIT } from "@/lib/queries/players";

const MAX_QUERY = 64;

export async function generateMetadata() {
  const copy = await requestCopy();
  return { title: `${copy.search.title} · ${copy.site.name}` };
}

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q: raw } = await searchParams;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, MAX_QUERY) ?? "";
  const [{ events, matches }, clock, copy] = await Promise.all([
    withPageDb(async (db) => ({
      events: await listEvents(db),
      matches: await searchPlayers(db, q),
    })),
    requestClock(),
    requestCopy(),
  ]);
  return (
    <>
      <SiteHeader
        events={events}
        currentId={null}
        homeId={homeEvent(events)?.id ?? null}
        section="players"
        clock={clock}
        copy={copy}
      />
      <main className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <h1 className="font-display text-display-lg leading-tight">{copy.search.title}</h1>
        <PlayerSearch q={q} maxLength={MAX_QUERY}>
          {q !== "" && matches.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center">
              <GrannyEmpty className="w-40 text-plum" />
              <p className="mt-3 max-w-[32ch] font-subhead text-display-sm font-semibold">
                {copy.search.noMatch}
              </p>
            </div>
          )}
          <ul>
            {matches.map((m) => (
              <li
                key={m.uid}
                className="stat-card relative mb-3 flex items-center gap-2 border border-rule p-3"
              >
                <PlayerAvatar uid={m.uid} hasAvatar={m.hasAvatar} />
                <div className="min-w-0 break-words">
                  <Link
                    href={`/players/${m.uid}`}
                    className="font-subhead text-display-sm leading-tight text-plum after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline"
                  >
                    {m.name}
                  </Link>
                  {m.matchedName && (
                    <span className="block text-sm text-ink/70">
                      {fill(copy.ledger.was, { name: m.matchedName })}
                    </span>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-sm">
                    <AllianceBadge badgeId={m.badgeId} />
                    {allianceLabel(m.tag, m.allianceName)}
                    <span className="text-ink/70">
                      · <span className={LABEL}>{copy.search.seen}</span> {clock.day(m.lastSeen)}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {matches.length === SEARCH_LIMIT && (
            <p className="text-sm text-ink/70">{fill(copy.search.limit, { n: SEARCH_LIMIT })}</p>
          )}
        </PlayerSearch>
      </main>
      <SiteFooter clock={clock} copy={copy} />
    </>
  );
}
