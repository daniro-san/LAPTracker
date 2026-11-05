// `/players/[uid]`: one player across events, shaped like the alliance page (plan Phase 5d, 5e).
import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { ExactToggle } from "@/app/_ui/ExactToggle";
import { allianceLabel, type Clock } from "@/app/_ui/format";
import { requestClock } from "@/app/_ui/locale";
import { AllianceBadge, PlayerAvatar } from "@/app/_ui/Pictures";
import { PlayerAcrossEvents } from "@/app/_ui/PlayerAcrossEvents";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { LABEL } from "@/app/_ui/StatTable";
import { Legend } from "@/app/_ui/Status";
import { copy } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import { listEvents, playerHistory, type PlayerHistory } from "@/lib/queries";

function Timelines({ history, clock }: { history: PlayerHistory; clock: Clock }) {
  const { names, alliances } = history;
  const span = (a: { firstSeen: Date; lastSeen: Date }) =>
    `${clock.day(a.firstSeen)} – ${clock.day(a.lastSeen)}`;
  return (
    <div className="mb-3 grid gap-3 text-sm sm:grid-cols-2">
      {names.length > 1 && (
        <div>
          <p className={LABEL}>{copy.ledger.names}</p>
          <ul>
            {names.map((n) => (
              <li key={n.name} className="break-words">
                {n.name} <span className="text-ink/70">· {span(n)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className={LABEL}>{copy.ledger.alliances}</p>
        <ul>
          {alliances.map((a) => (
            <li key={`${a.unionId}|${a.firstSeen.getTime()}`}>
              <Link
                href={`/events/${a.lastEventId}/alliances/${a.unionId}`}
                className="inline-flex min-h-11 items-center gap-2 font-medium text-plum hover:underline"
              >
                <AllianceBadge badgeId={a.badgeId} />
                {allianceLabel(a.tag, a.name)}
              </Link>{" "}
              <span className="text-ink/70">· {span(a)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default async function PlayerPage({ params }: { params: Promise<{ uid: string }> }) {
  const p = await params;
  if (!/^\d{1,15}$/.test(p.uid)) notFound();
  const [data, clock] = await Promise.all([
    withPageDb(async (db) => {
      const history = await playerHistory(db, Number(p.uid));
      return history && { history, events: await listEvents(db) };
    }),
    requestClock(),
  ]);
  if (!data) notFound();
  const { history, events } = data;
  const { current } = history;
  const allianceName = history.alliances.at(-1)?.name ?? null;
  return (
    <>
      <SiteHeader events={events} currentId={null} section="players" clock={clock} />
      <main className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <Breadcrumbs
          crumbs={[
            { key: "ledger", href: "/", label: copy.site.home },
            {
              key: "alliance",
              href: `/events/${current.eventId}/alliances/${current.unionId}`,
              label: (
                <>
                  <AllianceBadge badgeId={current.badgeId} />
                  {allianceLabel(current.tag, allianceName)}
                </>
              ),
            },
            { key: "player", label: current.name },
          ]}
        />
        <div className="flex min-w-0 items-center gap-3">
          <PlayerAvatar uid={history.uid} hasAvatar={current.hasAvatar} size="lg" />
          <h1 className="min-w-0 break-words font-display text-display-lg leading-tight">
            {current.name}
          </h1>
        </div>
        <div className="mt-3">
          <ExactToggle />
        </div>
        <Legend beforeOnly />
        <Timelines history={history} clock={clock} />
        <PlayerAcrossEvents rows={history.rows} clock={clock} />
      </main>
      <SiteFooter ornament="granny" />
    </>
  );
}
