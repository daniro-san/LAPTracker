// `/players?q=`: search by current or earlier name (plan Phase 5d, §3.8). Every match is listed.
import Link from "next/link";

import { allianceLabel } from "@/app/_ui/format";
import { requestClock } from "@/app/_ui/locale";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { LABEL } from "@/app/_ui/StatTable";
import { buttonClass } from "@/lib/brand/components/Button";
import { copy, fill } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { listEvents } from "@/lib/queries";
import { searchPlayers, SEARCH_LIMIT } from "@/lib/queries/players";

const MAX_QUERY = 64;

export const metadata = { title: `${copy.search.title} · ${copy.site.name}` };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q: raw } = await searchParams;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, MAX_QUERY) ?? "";
  const [{ events, matches }, clock] = await Promise.all([
    withPageDb(async (db) => ({
      events: await listEvents(db),
      matches: await searchPlayers(db, q),
    })),
    requestClock(),
  ]);
  return (
    <>
      <SiteHeader events={events} currentId={null} section="players" clock={clock} />
      <main className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <h1 className="font-display text-display-lg leading-tight">{copy.search.title}</h1>
        <form action="/players" method="get" role="search" className="my-3 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={MAX_QUERY}
            placeholder={copy.search.placeholder}
            aria-label={copy.search.placeholder}
            className="drawn-field min-h-11 min-w-0 flex-1 px-3"
          />
          <button type="submit" className={buttonClass("primary")}>
            {copy.search.submit}
          </button>
        </form>
        {q !== "" && matches.length === 0 && (
          <p className="py-6 text-center font-subhead text-display-sm">{copy.search.noMatch}</p>
        )}
        <ul>
          {matches.map((m) => (
            <li key={m.uid} className="stat-card relative mb-3 border border-rule p-3">
              <Link
                href={`/players/${m.uid}`}
                className="break-words font-subhead text-display-sm leading-tight text-plum after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline"
              >
                {m.name}
              </Link>
              {m.matchedName && (
                <span className="block text-sm text-ink/70">
                  {fill(copy.ledger.was, { name: m.matchedName })}
                </span>
              )}
              <div className="text-sm">
                {allianceLabel(m.tag, m.allianceName)}{" "}
                <span className="text-ink/70">
                  · <span className={LABEL}>{copy.search.seen}</span> {clock.day(m.lastSeen)}
                </span>
              </div>
            </li>
          ))}
        </ul>
        {matches.length === SEARCH_LIMIT && (
          <p className="text-sm text-ink/70">{fill(copy.search.limit, { n: SEARCH_LIMIT })}</p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
