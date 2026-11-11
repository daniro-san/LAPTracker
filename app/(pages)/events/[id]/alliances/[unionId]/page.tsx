// `/events/[id]/alliances/[unionId]`: one alliance in one event, then across events (plan Phase 5c, 5e).
// The totals as one summary band, then the members (same row shape as the main page), then one row
// per event.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

import {
  ACROSS_ID,
  AcrossEvents,
  inEventMarked,
  NameTimeline,
  TITLE_ID,
} from "@/app/_ui/AcrossEvents";
import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { DetailTable, figureRows, type RankPair } from "@/app/_ui/DetailLines";
import { fellWithLeavers } from "@/app/_ui/event-rows";
import { ExactToggle } from "@/app/_ui/ExactToggle";
import { allianceLabel, type Clock } from "@/app/_ui/format";
import { Leadership } from "@/app/_ui/Leadership";
import { requestClock, requestCopy } from "@/app/_ui/locale";
import { canCompare, leadership, memberViews, withRoles } from "@/app/_ui/member-views";
import { MembersExplorer } from "@/app/_ui/MembersExplorer";
import { memberScope } from "@/app/_ui/mover-lists";
import { Movers } from "@/app/_ui/Movers";
import { MyAllianceToggle } from "@/app/_ui/MyAlliance";
import { Delta, Num, Rank } from "@/app/_ui/Num";
import { AllianceBadge } from "@/app/_ui/Pictures";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { LABEL, type StatMetric } from "@/app/_ui/StatTable";
import { CaptureWindow, FreshDots, Legend, SideHead, type FreshState } from "@/app/_ui/Status";
import { rankDelta } from "@/lib/compute";
import type { Dictionary } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import type { AllianceRow, HistoryRow, Ranks } from "@/lib/queries";
import {
  allianceHistory,
  allianceNames,
  eventRanks,
  getAllianceDetail,
  homeEvent,
  listEvents,
  memberMovers,
} from "@/lib/queries";

const usable = (a: AllianceRow | null) => a !== null && a.isFresh && !a.failed;

const fresh = (a: AllianceRow | null): FreshState | null =>
  a ? { isFresh: a.isFresh, updatedAt: a.sourceUpdatedAt, failed: a.failed } : null;

type Detail = NonNullable<Awaited<ReturnType<typeof getAllianceDetail>>>;
type Ledger = Partial<Record<"before" | "after", Ranks>> | undefined;

function totalsMetric(
  label: string,
  before: number | null | undefined,
  after: number | null | undefined,
  canDelta: boolean,
  left = 0,
): StatMetric {
  const [b, a] = [before ?? null, after ?? null];
  const delta = canDelta && a !== null && b !== null ? a - b : null;
  return { label, value: a ?? b, delta, base: b, memberMark: fellWithLeavers(delta, left) };
}

/** The page shows a `*`: on the summary, or on a change inside an event under Across events. */
const showsMemberMark = (metrics: StatMetric[], history: HistoryRow[]) =>
  metrics.some((m) => m.memberMark) || inEventMarked(history);

/** `left`: members of the Before roster gone from the After roster (0 when the rosters cannot be compared). */
function totalsMetrics(
  { before, after }: Detail,
  canDelta: boolean,
  left: number,
  copy: Dictionary,
): StatMetric[] {
  const l = copy.ledger;
  return [
    totalsMetric(l.might, before?.totalPower, after?.totalPower, canDelta, left),
    totalsMetric(l.kills, before?.totalKills, after?.totalKills, canDelta, left),
    totalsMetric(l.members, before?.memberCount, after?.memberCount, canDelta),
  ];
}

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
  clock,
  copy,
}: {
  detail: Detail;
  metrics: StatMetric[];
  ledger: Ledger;
  canDelta: boolean;
  clock: Clock;
  copy: Dictionary;
}) {
  const { before, after } = detail;
  const ranks = rankPairs(detail, ledger, canDelta);
  return (
    <section aria-label={copy.ledger.alliance} className="border border-rule">
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
            </dd>
          </div>
        ))}
      </dl>
      <details className="group/more border-t border-rule px-2 sm:px-4">
        <summary className="flex min-h-11 cursor-pointer items-center gap-3 text-sm [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-baseline gap-2 text-base">
            <span className={LABEL}>{copy.ledger.rank}</span>
            <Rank n={ranks.might.after ?? ranks.might.before} move={ranks.might.move} />
          </span>
          <FreshDots before={fresh(before)} after={fresh(after)} copy={copy} />
          <span className="drawn-frame-soft ml-auto inline-flex min-h-11 items-center gap-1 px-3 font-medium text-plum group-open/more:bg-plum/10">
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

/** Shared by the page and its <title> within one request. */
const loadAlliance = cache((eventId: number, unionId: number) =>
  withPageDb(async (db) => {
    const detail = await getAllianceDetail(db, eventId, unionId);
    if (!detail) return null;
    const [events, history, names, ranks] = await Promise.all([
      listEvents(db),
      allianceHistory(db, unionId),
      allianceNames(db, [unionId]),
      eventRanks(db, eventId),
    ]);
    const phases = events.find((e) => e.id === eventId)?.snapshots ?? [];
    return {
      detail,
      events,
      homeId: homeEvent(events)?.id ?? null,
      history,
      names: names.get(unionId) ?? [],
      ledger: ranks.get(unionId),
      phases,
      movers: await memberMovers(db, phases, unionId),
    };
  }),
);

function views({ membersBefore, membersAfter, rolesBefore, rolesAfter }: Detail) {
  return withRoles(memberViews(membersBefore, membersAfter), rolesBefore, rolesAfter);
}

function MemberList({ detail, canDelta }: { detail: Detail; canDelta: boolean }) {
  const { before, after, membersBefore, membersAfter } = detail;
  return (
    <MembersExplorer
      members={views(detail)}
      canDelta={canDelta}
      compared={canCompare(membersBefore, membersAfter)}
      capacity={after?.capacity ?? before?.capacity ?? null}
    />
  );
}

type Params = Promise<{ id: string; unionId: string }>;

/** The two ids, or null when either is not a plain number. */
async function idsOf(params: Params) {
  const p = await params;
  if (!/^\d{1,9}$/.test(p.id) || !/^\d{1,15}$/.test(p.unionId)) return null;
  return { eventId: Number(p.id), unionId: Number(p.unionId) };
}

/** `[OGs] OldGrandmas · Sat, Oct 31 · Event Ledger`. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ids = await idsOf(params);
  const data = ids && (await loadAlliance(ids.eventId, ids.unionId));
  if (!data) return {};
  const [clock, copy] = await Promise.all([requestClock(), requestCopy()]);
  const now = data.detail.after ?? data.detail.before;
  const event = data.events.find((e) => e.id === ids.eventId);
  const parts = [
    allianceLabel(now?.tag ?? String(ids.unionId), now?.name ?? null),
    event && clock.weekday(event.eventAtUtc),
    copy.site.name,
  ];
  return { title: parts.filter(Boolean).join(" · ") };
}

type Events = Awaited<ReturnType<typeof listEvents>>;

/** `Ledger · Sat, Oct 31 › [TAG] Name`: back to the event, then this page. */
function crumbsFor(events: Events, eventId: number, label: string, clock: Clock, copy: Dictionary) {
  const event = events.find((e) => e.id === eventId);
  return [
    {
      key: "ledger",
      href: eventId === homeEvent(events)?.id ? "/" : `/events/${eventId}`,
      label: event ? `${copy.site.home} · ${clock.weekday(event.eventAtUtc)}` : copy.site.home,
    },
    { key: "alliance", label },
  ];
}

export default async function AlliancePage({ params }: { params: Params }) {
  const ids = await idsOf(params);
  if (!ids) notFound();
  const { eventId, unionId } = ids;
  const [data, clock, copy] = await Promise.all([
    loadAlliance(eventId, unionId),
    requestClock(),
    requestCopy(),
  ]);
  if (!data) notFound();
  const { detail, events, homeId, history, names, ledger, phases, movers } = data;
  const now = detail.after ?? detail.before;
  const label = allianceLabel(now?.tag ?? String(unionId), now?.name ?? null);
  const canDelta = usable(detail.before) && usable(detail.after);
  const left = canCompare(detail.membersBefore, detail.membersAfter)
    ? memberViews(detail.membersBefore, detail.membersAfter).filter((m) => m.status === "left")
        .length
    : 0;
  const metrics = totalsMetrics(detail, canDelta, left, copy);
  return (
    <>
      <SiteHeader events={events} currentId={eventId} homeId={homeId} clock={clock} copy={copy} />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <Breadcrumbs crumbs={crumbsFor(events, eventId, label, clock, copy)} />
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
                className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-plum hover:underline"
              >
                {copy.ledger.acrossEvents} <span aria-hidden="true">&nbsp;↓</span>
              </a>
            )}
            <Link
              href={`/alliances/${unionId}/history`}
              className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-plum hover:underline"
            >
              {copy.history.title} <span aria-hidden="true">&nbsp;→</span>
            </Link>
          </div>
        </div>
        <CaptureWindow
          before={phases.find((s) => s.phase === "before")}
          after={phases.find((s) => s.phase === "after")}
          clock={clock}
          copy={copy}
        />
        <Legend memberMark={showsMemberMark(metrics, history)} copy={copy} />
        <NameTimeline names={names} clock={clock} copy={copy} />
        <Summary
          detail={detail}
          metrics={metrics}
          ledger={ledger}
          canDelta={canDelta}
          clock={clock}
          copy={copy}
        />
        <Leadership members={leadership(views(detail))} />
        <Movers scopes={[memberScope(movers, null)]} />
        <h2 className="mb-2 mt-8 font-subhead text-display-md">{copy.ledger.members}</h2>
        <MemberList detail={detail} canDelta={canDelta} />
        <AcrossEvents unionId={unionId} history={history} clock={clock} />
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
