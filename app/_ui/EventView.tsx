// The comparison page for one event: `/` and `/events/[id]` render this (plan Phase 5, 5f). Top to
// bottom: ledger title and byline, the event's date, the status strip and legend, then every alliance by
// rank. Quota, run errors and the run buttons live on /admin. The game's own board feeds no number on this
// page (owner, 2026-11-05): here it is only a cross-check. D133 shows its numbers on /alliances and each
// alliance's own page, labelled "Ranks board", and this page links there.
import { TextLink } from "@/lib/brand/components/TextLink";
import type { NameHistoryEntry } from "@/lib/compute";
import { fill, type Dictionary } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import { isOn } from "@/lib/flags";
import { withPageDb } from "@/lib/page";
import type {
  Carried,
  getEventDetail,
  listEvents,
  Ranks,
  RosterChange,
  TurnoutLists,
} from "@/lib/queries";
import { boardCount } from "@/lib/queries/alliance-list";
import type { getEventPage } from "@/lib/queries/event-page";
import { nextEvent } from "@/lib/schedule";

import { BalanceLink, CompareLink } from "./ComparePicker";
import { DetailTable, figureRows } from "./DetailLines";
import { loadProgress } from "./event-page";
import {
  comparisonRows,
  emptyLine,
  nextUpdateAt,
  type AllianceCell,
  type ComparisonRow,
} from "./event-rows";
import { eventTitle, ManualMark } from "./EventLabel";
import { ExactToggle } from "./ExactToggle";
import { allianceLabel, rowAnchor, type Clock } from "./format";
import { LiveSections, LiveStrip } from "./LiveProgress";
import { requestClock, requestCopy, requestLocale } from "./locale";
import { allianceScope, memberScope } from "./mover-lists";
import { Movers } from "./Movers";
import { MyAllianceJump } from "./MyAlliance";
import { AllianceBadge } from "./Pictures";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { StatTable, type StatRow } from "./StatTable";
import { FreshDots, Legend, NextUpdate, SideHead, worstOf, type FreshState } from "./Status";
import { TopStatus } from "./TopStatus";
import { WhoCarried } from "./WhoCarried";
import { WhoFought } from "./WhoFought";

type Movers = NonNullable<Awaited<ReturnType<typeof getEventPage>>["page"]>["movers"];
type Detail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;
type Events = Awaited<ReturnType<typeof listEvents>>;

const fresh = (c: AllianceCell | undefined): FreshState | null =>
  c ? { isFresh: c.isFresh, updatedAt: c.sourceUpdatedAt, failed: c.failed } : null;

/** The full figures behind the simple card (DESIGN.md `details-table`): one table whose heads are the two
 * snapshot times, then the name history. */
function RowDetail({
  r,
  history,
  clock,
  copy,
}: {
  r: ComparisonRow;
  history: NameHistoryEntry[] | undefined;
  clock: Clock;
  copy: Dictionary;
}) {
  return (
    <>
      <DetailTable
        corner={clock.zone}
        from={<SideHead s={fresh(r.before)} clock={clock} copy={copy} />}
        to={r.after ? <SideHead s={fresh(r.after)} clock={clock} copy={copy} /> : null}
        rows={figureRows(r.metrics, r.ranks, copy.ledger.ranking)}
      />
      {history && history.length > 1 && (
        <ul className="mt-2 text-ink/70">
          {history.map((h) => (
            <li key={`${h.tag}|${h.name}`}>
              <bdi>{allianceLabel(h.tag, h.name)}</bdi> · {clock.day(h.firstSeen)} –{" "}
              {clock.day(h.lastSeen)}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function toStatRow(
  eventId: number,
  r: ComparisonRow,
  history: NameHistoryEntry[] | undefined,
  clock: Clock,
  copy: Dictionary,
): StatRow {
  // The After failed: the card keeps the Before figures and names their time instead of a bare `—`.
  const beforeTime = r.after?.failed ? r.before?.sourceUpdatedAt : null;
  const at = beforeTime ? clock.time(beforeTime) : null;
  return {
    key: String(r.unionId),
    anchor: rowAnchor(r.unionId),
    href: `/events/${eventId}/alliances/${r.unionId}`,
    rank: { n: r.rank, move: r.rank === null ? null : r.ranks.might.move },
    lead: allianceLabel(r.tag, r.name),
    icon: <AllianceBadge badgeId={r.after?.badgeId ?? r.before?.badgeId} />,
    sub:
      r.formerly && fill(copy.ledger.was, { name: allianceLabel(r.formerly.tag, r.formerly.name) }),
    metrics: at ? r.metrics.map((m) => (m.value === null ? m : { ...m, at })) : r.metrics,
    summary: <FreshDots before={fresh(r.before)} after={fresh(r.after)} copy={copy} />,
    detail: <RowDetail r={r} history={history} clock={clock} copy={copy} />,
  };
}

/** "Server 325 · Event Ledger", "kept by the Old Grandmas": the page title, under the header. */
function TitleBand({ copy }: { copy: Dictionary }) {
  return (
    <div className="mb-3">
      <h1 className="font-display text-display-lg leading-tight">{copy.site.ledger}</h1>
      <p className="text-body-sm text-ink/70">{copy.site.byline}</p>
      <hr className="drawn-rule mt-2 text-plum/40" />
    </div>
  );
}

/** The title row's controls: "⇄ Compare" (D57), the server balance link while its flag is on (D91), and
 * Exact numbers. */
async function TitleActions({
  events,
  eventId,
  copy,
}: {
  events: Events;
  eventId: number;
  copy: Dictionary;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <CompareLink events={events} eventId={eventId} copy={copy} />
      {(await isOn("server-balance")) && <BalanceLink copy={copy} />}
      <ExactToggle />
    </div>
  );
}

/** Under the ledger: the way to every alliance on the server (D133); none before the first board. */
async function AllAlliancesLink({ copy }: { copy: Dictionary }) {
  const n = await withPageDb(boardCount);
  if (n === 0) return null;
  return (
    <p className="mt-2">
      <TextLink href="/alliances" className="inline-flex min-h-11 items-center text-sm font-medium">
        {fill(copy.alliances.link, { n })}
        <span aria-hidden="true">&nbsp;→</span>
      </TextLink>
    </p>
  );
}

/** The event's date (and name) with the compare and exact-numbers controls. */
function EventHead({
  detail,
  events,
  clock,
  copy,
}: {
  detail: Detail;
  events: Events;
  clock: Clock;
  copy: Dictionary;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
      <div className="min-w-0">
        <h2 className="font-subhead text-display-md leading-tight">
          {eventTitle(detail) ?? clock.long(detail.eventAtUtc)}
        </h2>
        {eventTitle(detail) && (
          <p className="flex gap-1.5 text-sm">
            {detail.manual && <ManualMark copy={copy} />}
            {clock.long(detail.eventAtUtc)}
          </p>
        )}
      </div>
      <TitleActions events={events} eventId={detail.id} copy={copy} />
    </div>
  );
}

function moverScopesOf(
  movers: Movers,
  eventId: number,
  changes: Map<number, RosterChange>,
  copy: Dictionary,
) {
  return [
    allianceScope(movers.alliances, eventId, changes, copy),
    memberScope(movers.members, copy.ledger.members),
  ];
}

/** When the End ran; null until it has. */
function endTime(detail: Detail): Date | null {
  const end = detail.snapshots.find((s) => s.phase === "after");
  return end ? (end.finishedAt ?? end.startedAt) : null;
}

export async function EventView({
  events,
  homeId,
  detail,
  changes,
  names,
  ranks,
  movers,
  turnout,
  carried,
}: {
  movers: Movers;
  turnout: TurnoutLists | null;
  carried: Carried | null;
  events: Events;
  homeId: number | null;
  detail: Detail;
  changes: Map<number, RosterChange>;
  names: Map<number, NameHistoryEntry[]>;
  ranks: Map<number, Partial<Record<"before" | "after", Ranks>>>;
}) {
  const now = new Date();
  const [clock, copy, locale, progress] = await Promise.all([
    requestClock(),
    requestCopy(),
    requestLocale(),
    loadProgress(detail, now),
  ]);
  const rows = comparisonRows(detail.snapshots, changes, names, ranks, copy);
  const moverScopes = moverScopesOf(movers, detail.id, changes, copy);
  const liveProps = { eventId: detail.id, rows, endAt: endTime(detail), clock, copy, locale };
  const hasMovers = moverScopes.some((s) => Object.values(s.lists).some((l) => l && l.length > 0));
  return (
    <>
      <SiteHeader events={events} currentId={detail.id} homeId={homeId} clock={clock} copy={copy} />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <TitleBand copy={copy} />
        <EventHead detail={detail} events={events} clock={clock} copy={copy} />
        {progress && <LiveStrip {...liveProps} progress={progress} />}
        <TopStatus
          detail={detail}
          worst={rows.map((r) => worstOf(fresh(r.before), fresh(r.after)))}
          hasMovers={hasMovers}
          live={progress?.live === true}
          hasDuring={progress !== null && !progress.live && progress.readings > 0}
          now={now}
          clock={clock}
          copy={copy}
        />
        <Legend memberMark={rows.some((r) => r.metrics.some((m) => m.memberMark))} copy={copy} />
        <MyAllianceJump tags={Object.fromEntries(rows.map((r) => [r.unionId, r.tag]))} />
        {progress && <LiveSections {...liveProps} progress={progress} placement="above" />}
        <StatTable
          leadLabel={copy.ledger.alliance}
          columns={[copy.ledger.might, copy.ledger.kills, copy.ledger.members]}
          rows={rows.map((r) => toStatRow(detail.id, r, names.get(r.unionId), clock, copy))}
          empty={emptyLine(detail.manual, detail.snapshots.length, copy)}
          copy={copy}
        />
        <AllAlliancesLink copy={copy} />
        <NextUpdate
          at={nextUpdateAt(
            detail.snapshots.map((s) => s.phase),
            detail,
            nextEvent(now, getEnv()),
            now,
          )}
          manual={detail.manual}
          clock={clock}
          copy={copy}
        />
        <Movers scopes={moverScopes} />
        {progress && <LiveSections {...liveProps} progress={progress} placement="below" />}
        {turnout && <WhoFought eventId={detail.id} lists={turnout} />}
        {carried && <WhoCarried eventId={detail.id} carried={carried} />}
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
