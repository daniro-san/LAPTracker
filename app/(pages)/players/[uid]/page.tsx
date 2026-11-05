// `/players/[uid]`: one player across events, shaped like the alliance page (plan Phase 5d, 5e).
import Link from "next/link";
import { notFound } from "next/navigation";

import { ExactToggle } from "@/app/_ui/ExactToggle";
import { utcDay } from "@/app/_ui/format";
import { PlayerAcrossEvents } from "@/app/_ui/PlayerAcrossEvents";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { withPageDb } from "@/lib/page";
import { listEvents, playerHistory, type PlayerHistory } from "@/lib/queries";

const MUTED = "text-zinc-500 dark:text-zinc-400";

function Timelines({ history }: { history: PlayerHistory }) {
  const { names, alliances } = history;
  return (
    <div className={`mb-3 text-sm ${MUTED}`}>
      {names.length > 1 && (
        <>
          <h2 className="font-semibold">Names</h2>
          <ul className="mb-2">
            {names.map((n) => (
              <li key={n.name} className="break-words [overflow-wrap:anywhere]">
                {n.name} ({utcDay(n.firstSeen)} – {utcDay(n.lastSeen)})
              </li>
            ))}
          </ul>
        </>
      )}
      <h2 className="font-semibold">Alliances</h2>
      <ul>
        {alliances.map((a) => (
          <li key={`${a.unionId}|${a.firstSeen.getTime()}`}>
            <Link href={`/events/${a.lastEventId}/alliances/${a.unionId}`} className="underline">
              {a.tag} · {a.name}
            </Link>{" "}
            ({utcDay(a.firstSeen)} – {utcDay(a.lastSeen)})
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function PlayerPage({ params }: { params: Promise<{ uid: string }> }) {
  const p = await params;
  if (!/^\d{1,15}$/.test(p.uid)) notFound();
  const data = await withPageDb(async (db) => {
    const history = await playerHistory(db, Number(p.uid));
    return history && { history, events: await listEvents(db) };
  });
  if (!data) notFound();
  const { history, events } = data;
  const { current } = history;
  return (
    <>
      <SiteHeader events={events} currentId={null} />
      <main className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <Link href="/players" className="flex min-h-11 items-center text-sm underline">
          ← Find a player
        </Link>
        <h1 className="break-words text-xl font-bold [overflow-wrap:anywhere]">{current.name}</h1>
        <p className="mb-3">
          <Link
            href={`/events/${current.eventId}/alliances/${current.unionId}`}
            className="inline-flex min-h-11 items-center font-semibold underline"
          >
            {current.tag}
          </Link>
        </p>
        <Timelines history={history} />
        <ExactToggle />
        <PlayerAcrossEvents rows={history.rows} />
      </main>
    </>
  );
}
