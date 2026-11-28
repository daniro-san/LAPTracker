// `/players/[uid][?range=7d|30d|90d]`: one player, on the alliance page's head and growth card (issue 824): the
// photo, the name and the head's facts; might and kills over 7, 30 or 90 days of daily reads, with the 7-day
// comparison line and the events' readings as hollow dots (what was "Daily progress", issue 270); then History:
// the timelines and name history, day by day (issue 773) and the across-events view (plan Phase 5d, 5e).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { PlayerCompareLink } from "@/app/_ui/ComparePicker";
import { DossierHead } from "@/app/_ui/DossierHead";
import { ExactToggle } from "@/app/_ui/ExactToggle";
import { allianceLabel, type Clock } from "@/app/_ui/format";
import { rangeOf } from "@/app/_ui/growth";
import { GrowthCard } from "@/app/_ui/GrowthCard";
import { cardText, playerCard } from "@/app/_ui/link-card-facts";
import { notFoundTitle, requestClock, requestCopy, requestLocale } from "@/app/_ui/locale";
import { AllianceBadge, PlayerAvatar } from "@/app/_ui/Pictures";
import { PlayerAcrossEvents } from "@/app/_ui/PlayerAcrossEvents";
import { PlayerDays } from "@/app/_ui/PlayerDays";
import { HistoryHeading, playerAlliance, playerFacts, playerGrowth } from "@/app/_ui/PlayerDossier";
import { bandsOf, EventNote, summaryText } from "@/app/_ui/PlayerProgress";
import { cardPreview } from "@/app/_ui/preview";
import { sharedEvents, sharedPlayer } from "@/app/_ui/public-reads";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { LABEL } from "@/app/_ui/StatTable";
import { Legend } from "@/app/_ui/Status";
import { TextLink } from "@/lib/brand/components/TextLink";
import { type Dictionary } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { homeEvent, progressSteps, type PlayerHistory } from "@/lib/queries";
import { fill } from "@/lib/words";

function Timelines({
  history,
  clock,
  copy,
}: {
  history: PlayerHistory;
  clock: Clock;
  copy: Dictionary;
}) {
  const { names, alliances } = history;
  // One name and one alliance: the identity row already says it all.
  if (names.length < 2 && alliances.length < 2) return null;
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
                <bdi>{n.name}</bdi> <span className="text-ink/70">· {span(n)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className={LABEL}>{copy.ledger.alliances}</p>
        <ul>
          {alliances.map((a) => (
            <li
              key={`${a.unionId}|${a.firstSeen.getTime()}`}
              className="flex flex-wrap items-center gap-x-2"
            >
              <TextLink
                href={`/events/${a.lastEventId}/alliances/${a.unionId}`}
                className="inline-flex min-h-11 items-center gap-2 font-medium"
              >
                <AllianceBadge badgeId={a.badgeId} />
                {allianceLabel(a.tag, a.name)}
              </TextLink>
              <span className="text-ink/70">· {span(a)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Shared by the page and its <title> within one request, and with every viewer until the next write (D143).
 * An unknown uid is not kept (lib/public-cache.ts). */
const loadPlayer = cache(async (uid: number) => {
  const [player, events] = await Promise.all([sharedPlayer(uid), sharedEvents()]);
  return player && { ...player, events };
});

type Params = Promise<{ uid: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

/** Day by day's cursor (`?before=<ISO time>`); a malformed one reads as the newest page. */
const beforeOf = async (searchParams: Search) => {
  const { before } = await searchParams;
  const ms = typeof before === "string" ? Date.parse(before) : Number.NaN;
  return Number.isNaN(ms) ? null : new Date(ms);
};

const uidOf = async (params: Params) => {
  const { uid } = await params;
  return /^\d{1,15}$/.test(uid) ? Number(uid) : null;
};

/** `Name · Event Ledger`, with the player's card as the link preview (issue 830). */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const uid = await uidOf(params);
  const data = uid === null ? null : await loadPlayer(uid);
  if (!data) return notFoundTitle();
  const [copy, locale] = await Promise.all([requestCopy(), requestLocale()]);
  const title = `${data.history.current.name} · ${copy.site.name}`;
  const facts = cardText(playerCard(data.history, copy, locale));
  return { title, ...cardPreview(`/img/card/player/${data.history.uid}`, title, facts) };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadPlayer>>>;

/** The History tab: the timelines and name history, day by day and the across-events view. */
function History({
  data: { history, progress },
  before,
  clock,
  copy,
}: {
  data: Loaded;
  before: Date | null;
  clock: Clock;
  copy: Dictionary;
}) {
  return (
    <>
      <HistoryHeading copy={copy} />
      <div className="mt-3">
        <Legend copy={copy} />
      </div>
      <Timelines history={history} clock={clock} copy={copy} />
      <PlayerDays
        uid={history.uid}
        steps={progressSteps(progress.readings)}
        before={before}
        clock={clock}
        copy={copy}
      />
      <PlayerAcrossEvents
        rows={history.rows}
        clock={clock}
        showAlliance={new Set(history.alliances.map((a) => a.unionId)).size > 1}
      />
    </>
  );
}

/** The head: photo, name, Compare and the exact-numbers switch, the facts, and when they were read. */
function Head({ data, clock, copy }: { data: Loaded; clock: Clock; copy: Dictionary }) {
  const { history, progress, read } = data;
  const { current, uid } = history;
  const newest = progress.readings.at(-1);
  const alliance = playerAlliance(read, newest, history);
  const asOf = newest?.at ?? current.updatedAt;
  return (
    <>
      <DossierHead
        picture={<PlayerAvatar uid={uid} photo={current} size="lg" />}
        title={<bdi>{current.name}</bdi>}
        actions={
          <>
            <PlayerCompareLink
              eventIds={history.rows.map((r) => r.eventId)}
              uid={uid}
              copy={copy}
            />
            <ExactToggle />
          </>
        }
        facts={playerFacts({ read, alliance, newest, history, copy })}
      />
      {asOf && (
        <p className="mt-1 text-body-sm text-ink/70">
          {fill(copy.ledger.asOf, { time: clock.at(asOf) })}
        </p>
      )}
    </>
  );
}

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const uid = await uidOf(params);
  if (uid === null) notFound();
  const [data, clock, copy, locale, before, sp] = await Promise.all([
    loadPlayer(uid),
    requestClock(),
    requestCopy(),
    requestLocale(),
    beforeOf(searchParams),
    searchParams,
  ]);
  if (!data) notFound();
  const { history, events, progress, read } = data;
  const alliance = playerAlliance(read, progress.readings.at(-1), history);
  const growth = playerGrowth(progress.readings, locale, copy);
  const bands = bandsOf(progress.readings);
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
        <Breadcrumbs
          crumbs={[
            { key: "ledger", href: "/", label: copy.site.home },
            {
              key: "alliance",
              href: alliance.href,
              label: (
                <>
                  <AllianceBadge badgeId={alliance.badgeId} />
                  {allianceLabel(alliance.tag, alliance.name)}
                </>
              ),
            },
          ]}
        />
        <Head data={data} clock={clock} copy={copy} />
        {growth.length > 0 && (
          <GrowthCard
            series={growth}
            range={rangeOf(sp.range)}
            hrefOf={(r) => `/players/${uid}?range=${r}d`}
            clock={clock}
            copy={copy}
            lead={summaryText(progress, clock, locale, copy)}
            bands={bands}
            note={<EventNote bands={bands} clock={clock} copy={copy} />}
          />
        )}
        <History data={data} before={before} clock={clock} copy={copy} />
      </main>
      <SiteFooter ornament="granny" copy={copy} />
    </>
  );
}
