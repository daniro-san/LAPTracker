// The comparison page for one event: `/` and `/events/[id]` render this (plan Phase 5, 5f). Top to
// bottom: ledger title and byline, the event's date, the status strip and legend, then every alliance by
// rank. Quota, run errors and the run buttons live on /admin. The game's own board is not shown (owner,
// 2026-11-05): it is still collected as a cross-check but never feeds a number on the page.
import type { NameHistoryEntry } from "@/lib/compute";
import { fill, type Dictionary } from "@/lib/copy";
import { getEnv } from "@/lib/env";
import type { getEventDetail, listEvents, Ranks, RosterChange } from "@/lib/queries";
import type { getEventPage } from "@/lib/queries/event-page";
import { nextEvent } from "@/lib/schedule";

import { CompareLink } from "./ComparePicker";
import { DetailTable, figureRows } from "./DetailLines";
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
import { requestClock, requestCopy } from "./locale";
import { allianceScope, memberScope, MOVERS_ID } from "./mover-lists";
import { Movers } from "./Movers";
import { MyAllianceJump } from "./MyAlliance";
import { AllianceBadge } from "./Pictures";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { StatTable, type StatRow } from "./StatTable";
import {
  CaptureWindow,
  FreshDots,
  Legend,
  NextUpdate,
  SideHead,
  StatusChips,
  worstOf,
  type FreshState,
} from "./Status";

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
              {allianceLabel(h.tag, h.name)} · {clock.day(h.firstSeen)} – {clock.day(h.lastSeen)}
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

/** The title row's controls: "⇄ Compare" (D57) and Exact numbers. */
function TitleActions({
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
      <ExactToggle />
    </div>
  );
}

/** The status strip, the capture window and the jump link to Movers (UX review B1, S1, S3). */
function TopStatus({
  detail,
  worst,
  hasMovers,
  clock,
  copy,
}: {
  detail: Detail;
  worst: string[];
  hasMovers: boolean;
  clock: Clock;
  copy: Dictionary;
}) {
  return (
    <>
      <StatusChips
        phases={detail.snapshots}
        stale={worst.filter((w) => w === "stale").length}
        failed={worst.filter((w) => w === "failed").length}
        clock={clock}
        copy={copy}
      />
      <div className="-mb-2 flex flex-wrap items-center justify-between gap-x-3">
        <CaptureWindow
          before={detail.snapshots.find((s) => s.phase === "before")}
          after={detail.snapshots.find((s) => s.phase === "after")}
          clock={clock}
          copy={copy}
        />
        {hasMovers && (
          <a
            href={`#${MOVERS_ID}`}
            className="text-link ml-auto inline-flex min-h-11 items-center px-2 text-sm font-medium"
          >
            {copy.ledger.movers} <span aria-hidden="true">&nbsp;↓</span>
          </a>
        )}
      </div>
    </>
  );
}

export async function EventView({
  events,
  homeId,
  detail,
  changes,
  names,
  ranks,
  movers,
}: {
  movers: NonNullable<Awaited<ReturnType<typeof getEventPage>>["page"]>["movers"];
  events: Events;
  homeId: number | null;
  detail: Detail;
  changes: Map<number, RosterChange>;
  names: Map<number, NameHistoryEntry[]>;
  ranks: Map<number, Partial<Record<"before" | "after", Ranks>>>;
}) {
  const [clock, copy] = await Promise.all([requestClock(), requestCopy()]);
  const now = new Date();
  const rows = comparisonRows(detail.snapshots, changes, names, ranks, copy);
  const worst = rows.map((r) => worstOf(fresh(r.before), fresh(r.after)));
  const moverScopes = [
    allianceScope(movers.alliances, detail.id, changes, copy),
    memberScope(movers.members, copy.ledger.members),
  ];
  const hasMovers = moverScopes.some((s) => Object.values(s.lists).some((l) => l && l.length > 0));
  return (
    <>
      <SiteHeader events={events} currentId={detail.id} homeId={homeId} clock={clock} copy={copy} />
      <main id="main" className="scroll-mt-20 mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <TitleBand copy={copy} />
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
        <TopStatus detail={detail} worst={worst} hasMovers={hasMovers} clock={clock} copy={copy} />
        <Legend memberMark={rows.some((r) => r.metrics.some((m) => m.memberMark))} copy={copy} />
        <MyAllianceJump tags={Object.fromEntries(rows.map((r) => [r.unionId, r.tag]))} />
        <StatTable
          leadLabel={copy.ledger.alliance}
          columns={[copy.ledger.might, copy.ledger.kills, copy.ledger.members]}
          rows={rows.map((r) => toStatRow(detail.id, r, names.get(r.unionId), clock, copy))}
          empty={emptyLine(detail.manual, detail.snapshots.length, copy)}
          copy={copy}
        />
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
      </main>
      <SiteFooter copy={copy} />
    </>
  );
}
