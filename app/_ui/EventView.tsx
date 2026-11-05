// The comparison page for one event: `/` and `/events/[id]` render this (plan Phase 5). Server
// component, no run buttons: those live on /admin.
import type { NameHistoryEntry } from "@/lib/compute";
import { getEnv } from "@/lib/env";
import type { getEventDetail, listEvents } from "@/lib/queries";
import type { RosterChange } from "@/lib/queries";
import { describeInstant } from "@/lib/schedule";

import { comparisonRows, type AllianceCell, type ComparisonRow } from "./event-rows";
import { ExactToggle } from "./ExactToggle";
import { utcDay, utcStamp } from "./format";
import { AllianceBadge } from "./Pictures";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { StatTable, type StatRow } from "./StatTable";
import { FreshDots, FreshnessDetail, StatusChips, type FreshState } from "./Status";

type Detail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;
type Events = Awaited<ReturnType<typeof listEvents>>;

const fresh = (c: AllianceCell | undefined): FreshState | null =>
  c ? { isFresh: c.isFresh, updatedAt: c.sourceUpdatedAt, failed: c.failed } : null;

function formerlyText(f: NonNullable<ComparisonRow["formerly"]>): string {
  return `formerly ${f.tag} · ${f.name} (until ${utcDay(f.lastSeen)})`;
}

function toStatRow(
  eventId: number,
  r: ComparisonRow,
  history: NameHistoryEntry[] | undefined,
): StatRow {
  return {
    key: String(r.unionId),
    href: `/events/${eventId}/alliances/${r.unionId}`,
    lead: r.tag,
    icon: <AllianceBadge badgeId={r.after?.badgeId ?? r.before?.badgeId} />,
    sub: (
      <>
        {r.name}
        {r.formerly && <span className="block text-xs">{formerlyText(r.formerly)}</span>}
      </>
    ),
    metrics: r.metrics,
    summary: <FreshDots before={fresh(r.before)} after={fresh(r.after)} />,
    detail: (
      <>
        <FreshnessDetail before={fresh(r.before)} after={fresh(r.after)} />
        {history && history.length > 1 && (
          <ul className="mt-2">
            {history.map((h) => (
              <li key={`${h.tag}|${h.name}`}>
                {h.tag} · {h.name} ({utcDay(h.firstSeen)} – {utcDay(h.lastSeen)})
              </li>
            ))}
          </ul>
        )}
      </>
    ),
  };
}

function BoardSection({ detail, rows }: { detail: Detail; rows: ComparisonRow[] }) {
  const snap = detail.snapshots.find((s) => s.boardPulledAt) ?? null;
  const hasBoard = rows.some((r) => r.before?.powerBoard != null || r.after?.powerBoard != null);
  if (!hasBoard) return null;
  return (
    <details className="drawn-frame mt-6 px-3">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">
        Leaderboard numbers (for comparison only)
      </summary>
      <p className="pb-2 text-sm text-ink/70">
        Taken from the game's ranking board
        {snap?.boardPulledAt ? `, pulled ${utcStamp(snap.boardPulledAt)}` : ""}. Shown for
        comparison only; the changes above never use them.
      </p>
      <ul className="pb-2 text-sm">
        {rows.map((r) => {
          const c = r.after ?? r.before;
          return (
            <li key={r.unionId} className="flex min-h-8 justify-between gap-3 tabular-nums">
              <span>{r.tag}</span>
              <span>
                {c?.powerBoard?.toLocaleString("en-US") ?? "—"} might ·{" "}
                {c?.killsBoard?.toLocaleString("en-US") ?? "—"} kills
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function EventView({
  events,
  detail,
  changes,
  names,
}: {
  events: Events;
  detail: Detail;
  changes: Map<number, RosterChange>;
  names: Map<number, NameHistoryEntry[]>;
}) {
  const rows = comparisonRows(detail.snapshots, changes, names);
  const quota = [...detail.snapshots]
    .reverse()
    .find((s) => s.quotaRemainingAfter !== null)?.quotaRemainingAfter;
  return (
    <>
      <SiteHeader events={events} currentId={detail.id} />
      <main className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 font-display text-display-lg font-semibold">{detail.name}</h1>
          <ExactToggle />
        </div>
        <p className="mb-3 text-sm text-ink/70">
          Event starts {describeInstant(detail.eventAtUtc, getEnv())}
          {quota != null && ` · Data requests left today: ${quota}`}
        </p>
        <div className="mb-4">
          <StatusChips
            phases={detail.snapshots}
            beforeAt={detail.beforeAt}
            afterAt={detail.afterAt}
          />
        </div>
        <StatTable
          leadLabel="Alliance"
          columns={["Members", "Might", "Kills"]}
          rows={rows.map((r) => toStatRow(detail.id, r, names.get(r.unionId)))}
          empty="Nothing here yet. The first snapshot is taken shortly before the event starts."
        />
        <BoardSection detail={detail} rows={rows} />
      </main>
      <SiteFooter />
    </>
  );
}
