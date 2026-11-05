// `/players?q=`: search by current or earlier name (plan Phase 5d, §3.8). Every match is listed.
import Link from "next/link";

import { utcDay } from "@/app/_ui/format";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { buttonClass } from "@/lib/brand/components/Button";
import { withPageDb } from "@/lib/page";
import { listEvents } from "@/lib/queries";
import { searchPlayers, SEARCH_LIMIT } from "@/lib/queries/players";

const MAX_QUERY = 64;

export const metadata = { title: "Players · OG's LAP Tracker" };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q: raw } = await searchParams;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim().slice(0, MAX_QUERY) ?? "";
  const { events, matches } = await withPageDb(async (db) => ({
    events: await listEvents(db),
    matches: await searchPlayers(db, q),
  }));
  return (
    <>
      <SiteHeader events={events} currentId={null} section="players" />
      <main className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <h1 className="font-display text-display-lg font-semibold">Find a player</h1>
        <form action="/players" method="get" role="search" className="my-3 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={MAX_QUERY}
            placeholder="Player name, current or earlier"
            aria-label="Player name"
            className="drawn-field min-h-11 min-w-0 flex-1 px-3"
          />
          <button type="submit" className={buttonClass("primary")}>
            Search
          </button>
        </form>
        {q === "" && <p className="text-ink/70">Type part of a name. Earlier names match too.</p>}
        {q !== "" && matches.length === 0 && (
          <p className="py-6 text-center text-ink/70">No player matches “{q}”.</p>
        )}
        <ul>
          {matches.map((m) => (
            <li key={m.uid} className="stat-card relative mb-3 border border-rule p-3">
              <Link
                href={`/players/${m.uid}`}
                className="break-words font-semibold [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline"
              >
                {m.name}
              </Link>
              {m.matchedName && (
                <span className="text-sm text-ink/70"> (earlier name: {m.matchedName})</span>
              )}
              <div className="text-sm text-ink/70">
                {m.tag} · {m.allianceName} · last seen {utcDay(m.lastSeen)}
              </div>
            </li>
          ))}
        </ul>
        {matches.length === SEARCH_LIMIT && (
          <p className="text-sm text-ink/70">
            Showing the first {SEARCH_LIMIT} matches. Type more of the name to narrow it down.
          </p>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
