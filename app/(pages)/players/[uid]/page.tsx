// `/players/[uid]`: one player across events, shaped like the alliance page (plan Phase 5d, 5e).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { PlayerCompareLink } from "@/app/_ui/ComparePicker";
import { ExactToggle } from "@/app/_ui/ExactToggle";
import { allianceLabel, type Clock } from "@/app/_ui/format";
import { cardText, playerCard } from "@/app/_ui/link-card-facts";
import { notFoundTitle, requestClock, requestCopy, requestLocale } from "@/app/_ui/locale";
import { Num } from "@/app/_ui/Num";
import { AllianceBadge, PlayerAvatar } from "@/app/_ui/Pictures";
import { PlayerAcrossEvents } from "@/app/_ui/PlayerAcrossEvents";
import { PlayerDays } from "@/app/_ui/PlayerDays";
import { PlayerProgress } from "@/app/_ui/PlayerProgress";
import { cardPreview } from "@/app/_ui/preview";
import { sharedEvents, sharedPlayer } from "@/app/_ui/public-reads";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { LABEL } from "@/app/_ui/StatTable";
import { FreshDots, Legend } from "@/app/_ui/Status";
import { RoleMark } from "@/lib/brand/components/RoleMark";
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

/** The latest stored Might, Kills and Level as one band (no second title), like the alliance page's. */
function Summary({
  current,
  clock,
  copy,
}: {
  current: PlayerHistory["current"];
  clock: Clock;
  copy: Dictionary;
}) {
  const l = copy.ledger;
  const figures = [
    { label: l.might, value: current.power },
    { label: l.kills, value: current.kills },
    { label: l.level, value: current.lv },
  ];
  const state = { isFresh: current.isFresh, updatedAt: current.updatedAt, failed: false };
  return (
    <section aria-label={l.player} className="drawn-card">
      <dl className="grid grid-cols-3 divide-x divide-rule">
        {figures.map((f) => (
          <div key={f.label} className="min-w-0 px-2 py-2 sm:px-4">
            <dt className={LABEL}>{f.label}</dt>
            <dd className="text-xl font-medium tabular-nums">
              <Num n={f.value} />
            </dd>
          </div>
        ))}
      </dl>
      <p className="flex min-h-11 flex-wrap items-center gap-x-3 border-t border-rule px-2 text-sm text-ink/70 sm:px-4">
        {current.updatedAt && fill(l.asOf, { time: clock.at(current.updatedAt) })}
        <FreshDots before={null} after={state} copy={copy} />
      </p>
    </section>
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

/** The title row: photo, name, alliance link and role, with Compare and the exact-numbers switch. */
function PlayerHead({
  history,
  allianceName,
  copy,
}: {
  history: PlayerHistory;
  allianceName: string | null;
  copy: Dictionary;
}) {
  const { current } = history;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <div className="flex min-w-0 items-center gap-3">
        <PlayerAvatar uid={history.uid} photo={current} size="lg" />
        <div className="min-w-0">
          <h1 className="break-words font-display text-display-lg leading-tight">
            <bdi>{current.name}</bdi>
          </h1>
          <TextLink
            href={`/events/${current.eventId}/alliances/${current.unionId}`}
            className="inline-flex min-h-11 items-center gap-2 font-medium"
          >
            <AllianceBadge badgeId={current.badgeId} />
            {allianceLabel(current.tag, allianceName)}
          </TextLink>
          {current.role && (
            <p className="flex items-center gap-2 text-sm text-ink/70">
              <RoleMark role={current.role} />
              {current.role.kind === "officer" ? current.role.title : copy.leadership.leader}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PlayerCompareLink
          eventIds={history.rows.map((r) => r.eventId)}
          uid={history.uid}
          copy={copy}
        />
        <ExactToggle />
      </div>
    </div>
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
  const [data, clock, copy, before] = await Promise.all([
    loadPlayer(uid),
    requestClock(),
    requestCopy(),
    beforeOf(searchParams),
  ]);
  if (!data) notFound();
  const { history, events, progress } = data;
  const { current } = history;
  const allianceName = history.alliances.at(-1)?.name ?? null;
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
              href: `/events/${current.eventId}/alliances/${current.unionId}`,
              label: (
                <>
                  <AllianceBadge badgeId={current.badgeId} />
                  {allianceLabel(current.tag, allianceName)}
                </>
              ),
            },
          ]}
        />
        <PlayerHead history={history} allianceName={allianceName} copy={copy} />
        <Legend copy={copy} />
        <Timelines history={history} clock={clock} copy={copy} />
        <Summary current={current} clock={clock} copy={copy} />
        <PlayerProgress progress={progress} clock={clock} />
        <PlayerDays
          uid={uid}
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
      </main>
      <SiteFooter ornament="granny" copy={copy} />
    </>
  );
}
