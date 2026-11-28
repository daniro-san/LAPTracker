// `/events/[id]/alliances/[unionId][?show=joined|left][&sort=<key>]`: one alliance in one event, then across
// events (plan Phase 5c, 5e). The totals as one summary band, then the members (same row shape as the main
// page), then one row per event. `show` and `sort` start the member list filtered or sorted: the drilldowns
// from the ledger, the split, War turnout and Kill share land here, on `#members`; such a view is not indexed.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ACROSS_ID, AcrossEvents, NameTimeline, TITLE_ID } from "@/app/_ui/AcrossEvents";
import { canChange, showsMemberMark, totalsMetrics } from "@/app/_ui/alliance-totals";
import { AllianceLinks } from "@/app/_ui/AllianceLinks";
import { AllianceStatementCard } from "@/app/_ui/AllianceStatement";
import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { DetailTable, figureRows, type RankPair } from "@/app/_ui/DetailLines";
import { EventMembers } from "@/app/_ui/EventMembers";
import { ExactToggle } from "@/app/_ui/ExactToggle";
import { allianceLabel, type Clock } from "@/app/_ui/format";
import { Leadership } from "@/app/_ui/Leadership";
import { allianceCard, cardText } from "@/app/_ui/link-card-facts";
import { notFoundTitle, requestClock, requestCopy, requestLocale } from "@/app/_ui/locale";
import { leadership, viewsOf } from "@/app/_ui/member-views";
import { memberScope } from "@/app/_ui/mover-lists";
import { Movers } from "@/app/_ui/Movers";
import { MyAllianceToggle } from "@/app/_ui/MyAlliance";
import { Delta, Num, Rank } from "@/app/_ui/Num";
import { AllianceBadge } from "@/app/_ui/Pictures";
import { cardPreview } from "@/app/_ui/preview";
import { sharedEvents } from "@/app/_ui/public-reads";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { SplitMark } from "@/app/_ui/SplitMark";
import { AllianceStanding } from "@/app/_ui/Standing";
import { LABEL, type StatMetric } from "@/app/_ui/StatTable";
import { CaptureWindow, FreshDots, Legend, SideHead, type FreshState } from "@/app/_ui/Status";
import { rankDelta } from "@/lib/compute";
import type { Dictionary } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { withPageDb } from "@/lib/page";
import type { AllianceRow, Ranks } from "@/lib/queries";
import {
  allianceHistory,
  allianceNames,
  allianceStatement,
  eventBetweenIds,
  eventRanks,
  getAllianceDetail,
  homeEvent,
  memberMovers,
  rosterChanges,
} from "@/lib/queries";

const fresh = (a: AllianceRow | null): FreshState | null =>
  a ? { isFresh: a.isFresh, updatedAt: a.sourceUpdatedAt, failed: a.failed } : null;

type Detail = NonNullable<Awaited<ReturnType<typeof getAllianceDetail>>>;
type Ledger = Partial<Record<"before" | "after", Ranks>> | undefined;

function rankPairs(detail: Detail, ledger: Ledger, canMove: boolean) {
  const pair = (before: number | null | undefined, after: number | null | undefined): RankPair => ({
    before: before ?? null,
    after: after ?? null,
    move: canMove ? rankDelta(before, after) : null,
  });
  return {
    might: pair(ledger?.before?.might, ledger?.after?.might),
    kills: pair(ledger?.before?.kills, ledger?.after?.kills),
    server: pair(detail.before?.serverRank, detail.after?.serverRank),
  };
}

/** The alliance's totals as one band (no second title): three figures, then rank, marks and Details. */
function Summary({
  detail,
  metrics,
  ledger,
  canDelta,
  page,
  clock,
  copy,
}: {
  detail: Detail;
  metrics: StatMetric[];
  ledger: Ledger;
  canDelta: boolean;
  /** This page's path: the split's joiners and leavers open its member list. */
  page: string;
  clock: Clock;
  copy: Dictionary;
}) {
  const { before, after } = detail;
  const ranks = rankPairs(detail, ledger, canDelta);
  return (
    <section aria-label={copy.ledger.alliance} className="drawn-card">
      <dl className="grid grid-cols-3 divide-x divide-rule">
        {metrics.map((m) => (
          <div key={m.label} className="min-w-0 px-2 py-2 sm:px-4">
            <dt className={LABEL}>{m.label}</dt>
            <dd className="text-xl font-medium tabular-nums">
              <Num n={m.value} />
            </dd>
            <dd className="text-sm tabular-nums">
              <Delta
                delta={m.delta}
                base={m.base ?? null}
                stack
                memberMark={m.memberMark === true}
              />
              {m.split && m.delta !== null && (
                <SplitMark total={m.delta} split={m.split} name={m.label} page={page} />
              )}
            </dd>
          </div>
        ))}
      </dl>
      <details className="group/more border-t border-rule px-2 sm:px-4">
        <summary className="details-bar flex min-h-11 items-center gap-3 text-sm [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-baseline gap-2 text-base">
            <span className={LABEL}>{copy.ledger.rank}</span>
            <Rank n={ranks.might.after ?? ranks.might.before} move={ranks.might.move} />
          </span>
          <FreshDots before={fresh(before)} after={fresh(after)} copy={copy} />
          <span className="drawn-frame-soft tint-button ml-auto inline-flex min-h-11 items-center gap-1 px-3 font-medium text-plum group-open/more:bg-plum/10">
            {copy.ledger.details}
            <span
              aria-hidden="true"
              className="transition-transform duration-150 group-open/more:rotate-180 motion-reduce:transition-none"
            >
              ▾
            </span>
          </span>
        </summary>
        <div className="border-t border-rule pb-2 pt-2 text-sm">
          <DetailTable
            corner={clock.zone}
            from={<SideHead s={fresh(before)} clock={clock} copy={copy} />}
            to={after && <SideHead s={fresh(after)} clock={clock} copy={copy} />}
            rows={figureRows(metrics, ranks, copy.ledger.ranking)}
          />
        </div>
      </details>
    </section>
  );
}

/** The alliance's roster change from Start to End (D69 amendment, 2026-11-21); undefined before the End. */
async function changeOf(
  db: Parameters<typeof rosterChanges>[0],
  events: Awaited<ReturnType<typeof sharedEvents>>,
  eventId: number,
  unionId: number,
) {
  const phases = events.find((e) => e.id === eventId)?.snapshots ?? [];
  const [b, a] = (["before", "after"] as const).map((p) => phases.find((s) => s.phase === p));
  if (!b || !a) return undefined;
  return (await rosterChanges(db, eventId, { before: b.id, after: a.id }, unionId)).get(unionId);
}

/** Shared by the page and its <title> within one request. */
const loadAlliance = cache((eventId: number, unionId: number) =>
  withPageDb(async (db) => {
    const detail = await getAllianceDetail(db, eventId, unionId);
    if (!detail) return null;
    const listed = sharedEvents();
    const [events, history, names, ranks, statement, change] = await Promise.all([
      listed,
      allianceHistory(db, unionId),
      allianceNames(db, [unionId]),
      eventRanks(db, eventId),
      allianceStatement(db, unionId),
      listed.then((list) => changeOf(db, list, eventId, unionId)),
    ]);
    const phases = events.find((e) => e.id === eventId)?.snapshots ?? [];
    return {
      change,
      detail,
      events,
      homeId: homeEvent(events, new Date(), getEnv().SNAPSHOT_WINDOW_MIN)?.id ?? null,
      history,
      names: names.get(unionId) ?? [],
      ledger: ranks.get(unionId),
      statement,
      phases,
      movers: await memberMovers(db, phases, await eventBetweenIds(db, eventId), unionId),
    };
  }),
);

type Params = Promise<{ id: string; unionId: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;
type Props = { params: Params; searchParams: Search };

/** A filtered or sorted member list (the drilldowns) is not indexed. */
const noIndex = (sp: Awaited<Search>) =>
  sp.show !== undefined || sp.sort !== undefined ? { robots: { index: false } } : {};

/** The two ids, or null when either is not a plain number. */
async function idsOf(params: Params) {
  const p = await params;
  if (!/^\d{1,9}$/.test(p.id) || !/^\d{1,15}$/.test(p.unionId)) return null;
  return { eventId: Number(p.id), unionId: Number(p.unionId) };
}

/** `[OGs] OldGrandmas · Sat, Oct 31 · Event Ledger`. A filtered or sorted member list is not indexed. */
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [ids, sp] = await Promise.all([idsOf(params), searchParams]);
  const data = ids && (await loadAlliance(ids.eventId, ids.unionId));
  if (!data) return notFoundTitle();
  const [clock, copy, locale] = await Promise.all([requestClock(), requestCopy(), requestLocale()]);
  const now = data.detail.after ?? data.detail.before;
  const event = data.events.find((e) => e.id === ids.eventId);
  const label = allianceLabel(now?.tag ?? String(ids.unionId), now?.name ?? null);
  const title = [label, event && clock.weekday(event.eventAtUtc), copy.site.name]
    .filter(Boolean)
    .join(" · ");
  const url = `/img/card/event/${ids.eventId}/alliance/${ids.unionId}`;
  return { title, ...cardPreview(url, title, summaryText(data, copy, locale)), ...noIndex(sp) };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadAlliance>>>;

/** The summary band's figures and rank, as the page shows them: the link preview's text (issue 830). */
function summaryText({ detail, ledger, change }: Loaded, copy: Dictionary, locale: string) {
  const metrics = totalsMetrics(detail, canChange(detail), change, copy);
  const rank = ledger?.after?.might ?? ledger?.before?.might ?? null;
  return cardText(allianceCard({ tag: "", name: "", metrics, rank }, null, copy, locale));
}

/** `Ledger · Sat, Oct 31 › [TAG] Name`: back to the event (`/` when it is the home event), then this page. */
function crumbsFor(data: Loaded, eventId: number, label: string, clock: Clock, copy: Dictionary) {
  const { events, homeId } = data;
  const event = events.find((e) => e.id === eventId);
  return [
    {
      key: "ledger",
      href: eventId === homeId ? "/" : `/events/${eventId}`,
      label: event ? `${copy.site.home} · ${clock.weekday(event.eventAtUtc)}` : copy.site.home,
    },
    { key: "alliance", label },
  ];
}

export default async function AlliancePage({ params, searchParams }: Props) {
  const ids = await idsOf(params);
  if (!ids) notFound();
  const { eventId, unionId } = ids;
  const [data, clock, copy, locale] = await Promise.all([
    loadAlliance(eventId, unionId),
    requestClock(),
    requestCopy(),
    requestLocale(),
  ]);
  if (!data) notFound();
  const { detail, events, homeId, history, names, ledger, statement, phases, movers, change } =
    data;
  const now = detail.after ?? detail.before;
  const label = allianceLabel(now?.tag ?? String(unionId), now?.name ?? null);
  const canDelta = canChange(detail);
  const metrics = totalsMetrics(detail, canDelta, change, copy);
  const page = `/events/${eventId}/alliances/${unionId}`;
  return (
    <>
      <SiteHeader events={events} currentId={eventId} homeId={homeId} clock={clock} copy={copy} />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <Breadcrumbs crumbs={crumbsFor(data, eventId, label, clock, copy)} />
        <div
          id={TITLE_ID}
          className="flex scroll-mt-20 flex-wrap items-center justify-between gap-x-3 gap-y-2"
        >
          <div className="flex min-w-0 items-center gap-3">
            <AllianceBadge badgeId={now?.badgeId} size="md" />
            <h1 className="min-w-0 break-words font-display text-display-lg leading-tight">
              {label}
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <MyAllianceToggle unionId={unionId} />
            <ExactToggle />
            {history.length > 0 && (
              <a
                href={`#${ACROSS_ID}`}
                className="text-link inline-flex min-h-11 items-center px-2 text-sm font-medium"
              >
                {copy.ledger.acrossEvents} <span aria-hidden="true">&nbsp;↓</span>
              </a>
            )}
            <AllianceLinks unionId={unionId} copy={copy} />
          </div>
        </div>
        <CaptureWindow
          before={phases.find((s) => s.phase === "before")}
          after={phases.find((s) => s.phase === "after")}
          now={new Date()}
          clock={clock}
          copy={copy}
        />
        <Legend
          memberMark={showsMemberMark(metrics, history)}
          split={metrics.some((m) => m.split)}
          copy={copy}
        />
        <NameTimeline names={names} clock={clock} copy={copy} />
        <Summary
          detail={detail}
          metrics={metrics}
          ledger={ledger}
          canDelta={canDelta}
          page={page}
          clock={clock}
          copy={copy}
        />
        <AllianceStatementCard statement={statement} clock={clock} locale={locale} copy={copy} />
        <Leadership members={leadership(viewsOf(detail))} />
        <Movers scopes={[memberScope(movers, null)]} />
        <EventMembers {...{ detail, canDelta, clock, page }} search={searchParams} />
        <AllianceStanding unionId={unionId} clock={clock} copy={copy} />
        <AcrossEvents unionId={unionId} history={history} clock={clock} />
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
