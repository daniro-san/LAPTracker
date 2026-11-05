// `/players?q=`: search by current or earlier name (plan Phase 5d, §3.8). Every match is listed.
import Link from "next/link";

import { utcDay } from "@/app/_ui/format";
import { SiteHeader } from "@/app/_ui/SiteHeader";
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
      <SiteHeader events={events} currentId={null} />
      <main className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <h1 className="text-xl font-bold">Find a player</h1>
        <form action="/players" method="get" role="search" className="my-3 flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            maxLength={MAX_QUERY}
            placeholder="Player name, current or earlier"
            aria-label="Player name"
            className="min-h-11 min-w-0 flex-1 rounded-xs border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="min-h-11 rounded-xs border border-zinc-800 px-4 font-medium dark:border-zinc-200"
          >
            Search
          </button>
        </form>
        {q === "" && (
          <p className="text-zinc-500 dark:text-zinc-400">
            Type part of a name. Earlier names match too.
          </p>
        )}
        {q !== "" && matches.length === 0 && (
          <p className="py-6 text-center text-zinc-500 dark:text-zinc-400">
            No player matches “{q}”.
          </p>
        )}
        <ul>
          {matches.map((m) => (
            <li
              key={m.uid}
              className="relative mb-3 border border-zinc-300 p-3 dark:border-zinc-700"
            >
              <Link
                href={`/players/${m.uid}`}
                className="break-words font-semibold [overflow-wrap:anywhere] after:absolute after:inset-0 after:content-[''] hover:underline focus-visible:underline"
              >
                {m.name}
              </Link>
              {m.matchedName && (
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {" "}
                  (earlier name: {m.matchedName})
                </span>
              )}
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {m.tag} · {m.allianceName} · last seen {utcDay(m.lastSeen)}
              </div>
            </li>
          ))}
        </ul>
        {matches.length === SEARCH_LIMIT && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Showing the first {SEARCH_LIMIT} matches. Type more of the name to narrow it down.
          </p>
        )}
      </main>
    </>
  );
}
