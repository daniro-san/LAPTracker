// `/events/[id]/alliances/[unionId]`: one alliance in one event, then across events (plan Phase 5c, 5e).
// Same row shape as the main page: the totals card, then the members, then one row per event.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { ACROSS_ID, AcrossEvents } from "@/app/_ui/AcrossEvents";
import { Breadcrumbs } from "@/app/_ui/Breadcrumbs";
import { DetailTable, figureRows, type RankPair } from "@/app/_ui/DetailLines";
import { ExactToggle } from "@/app/_ui/ExactToggle";
import { allianceLabel, type Clock } from "@/app/_ui/format";
import { requestClock } from "@/app/_ui/locale";
import { memberViews } from "@/app/_ui/member-views";
import { MembersExplorer } from "@/app/_ui/MembersExplorer";
import { MyAllianceToggle } from "@/app/_ui/MyAlliance";
import { AllianceBadge } from "@/app/_ui/Pictures";
import { SiteFooter } from "@/app/_ui/SiteFooter";
import { SiteHeader } from "@/app/_ui/SiteHeader";
import { LABEL, StatTable, type StatMetric } from "@/app/_ui/StatTable";
import { FreshDots, Legend, SideHead, type FreshState } from "@/app/_ui/Status";
import { rankDelta, type NameHistoryEntry } from "@/lib/compute";
import { copy } from "@/lib/copy";
import { withPageDb } from "@/lib/page";
import type { AllianceRow, Ranks } from "@/lib/queries";
import {
  allianceHistory,
  allianceNames,
  eventRanks,
  getAllianceDetail,
  listEvents,
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
): StatMetric {
  const [b, a] = [before ?? null, after ?? null];
  return {
    label,
    value: a ?? b,
    delta: canDelta && a !== null && b !== null ? a - b : null,
    base: b,
  };
}

function totalsMetrics({ before, after }: Detail, canDelta: boolean): StatMetric[] {
  const l = copy.ledger;
  return [
    totalsMetric(l.might, before?.totalPower, after?.totalPower, canDelta),
    totalsMetric(l.kills, before?.totalKills, after?.totalKills, canDelta),
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

function Totals({
  detail,
  ledger,
  canDelta,
  clock,
}: {
  detail: Detail;
  ledger: Ledger;
  canDelta: boolean;
  clock: Clock;
}) {
  const { before, after } = detail;
  const now = after ?? before;
  const ranks = rankPairs(detail, ledger, canDelta);
  const l = copy.ledger;
  const metrics = totalsMetrics(detail, canDelta);
  return (
    <StatTable
      leadLabel={l.alliance}
      columns={[l.might, l.kills, l.members]}
      rows={[
        {
          key: "totals",
          rank: { n: ranks.might.after ?? ranks.might.before, move: ranks.might.move },
          lead: allianceLabel(now?.tag ?? null, now?.name ?? null),
          icon: <AllianceBadge badgeId={now?.badgeId} />,
          metrics,
          summary: <FreshDots before={fresh(before)} after={fresh(after)} />,
          detail: (
            <DetailTable
              corner={copy.ledger.serverTime}
              from={<SideHead s={fresh(before)} clock={clock} />}
              to={<SideHead s={fresh(after)} clock={clock} />}
              rows={figureRows(metrics, ranks, l.ranking)}
            />
          ),
        },
      ]}
    />
  );
}

function NameTimeline({ names, clock }: { names: NameHistoryEntry[]; clock: Clock }) {
  if (names.length < 2) return null;
  return (
    <div className="mb-3 text-sm text-ink/70">
      <p className={LABEL}>{copy.ledger.names}</p>
      <ul>
        {names.map((n) => (
          <li key={`${n.tag}|${n.name}`}>
            {allianceLabel(n.tag, n.name)} · {clock.day(n.firstSeen)} – {clock.day(n.lastSeen)}
          </li>
        ))}
      </ul>
    </div>
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
    return { detail, events, history, names: names.get(unionId) ?? [], ledger: ranks.get(unionId) };
  }),
);

type Params = Promise<{ id: string; unionId: string }>;

/** The two ids, or null when either is not a plain number. */
async function idsOf(params: Params) {
  const p = await params;
  if (!/^\d{1,9}$/.test(p.id) || !/^\d{1,15}$/.test(p.unionId)) return null;
  return { eventId: Number(p.id), unionId: Number(p.unionId) };
}

/** `[OGs] OldGrandmas · Sat, Oct 31 · OG's LAP Tracker`. */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const ids = await idsOf(params);
  const data = ids && (await loadAlliance(ids.eventId, ids.unionId));
  if (!data) return {};
  const clock = await requestClock();
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
function crumbsFor(events: Events, eventId: number, label: string, clock: Clock) {
  const event = events.find((e) => e.id === eventId);
  return [
    {
      key: "ledger",
      href: eventId === events[0]?.id ? "/" : `/events/${eventId}`,
      label: event ? `${copy.site.home} · ${clock.weekday(event.eventAtUtc)}` : copy.site.home,
    },
    { key: "alliance", label },
  ];
}

export default async function AlliancePage({ params }: { params: Params }) {
  const ids = await idsOf(params);
  if (!ids) notFound();
  const { eventId, unionId } = ids;
  const [data, clock] = await Promise.all([loadAlliance(eventId, unionId), requestClock()]);
  if (!data) notFound();
  const { detail, events, history, names, ledger } = data;
  const now = detail.after ?? detail.before;
  const label = allianceLabel(now?.tag ?? String(unionId), now?.name ?? null);
  const canDelta = usable(detail.before) && usable(detail.after);
  return (
    <>
      <SiteHeader events={events} currentId={eventId} clock={clock} />
      <main className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <Breadcrumbs crumbs={crumbsFor(events, eventId, label, clock)} />
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <AllianceBadge badgeId={now?.badgeId} size="md" />
            <h1 className="min-w-0 break-words font-display text-display-lg leading-tight">
              {label}
            </h1>
          </div>
          <ExactToggle />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <MyAllianceToggle unionId={unionId} />
          {history.length > 0 && (
            <a
              href={`#${ACROSS_ID}`}
              className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-plum hover:underline"
            >
              {copy.ledger.acrossEvents} <span aria-hidden="true">&nbsp;↓</span>
            </a>
          )}
        </div>
        <Legend />
        <NameTimeline names={names} clock={clock} />
        <Totals detail={detail} ledger={ledger} canDelta={canDelta} clock={clock} />
        <h2 className="mb-2 mt-8 font-subhead text-display-md">{copy.ledger.members}</h2>
        <MembersExplorer
          members={memberViews(detail.membersBefore, detail.membersAfter)}
          canDelta={canDelta}
        />
        <AcrossEvents unionId={unionId} history={history} clock={clock} />
      </main>
      <SiteFooter />
    </>
  );
}
