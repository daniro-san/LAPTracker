// The comparison page for one event: `/` and `/events/[id]` render this (plan Phase 5). Server
// component, no run buttons: those live on /admin.
import type { NameHistoryEntry } from "@/lib/compute";
import { getEnv } from "@/lib/env";
import type { getEventDetail, listEvents } from "@/lib/queries";
import type { RosterChange } from "@/lib/queries";
import { describeInstant } from "@/lib/schedule";

import { comparisonRows, type AllianceCell, type ComparisonRow } from "./event-rows";
import { utcDay, utcStamp } from "./format";
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
    <details className="mt-6 border border-zinc-300 px-3 dark:border-zinc-700">
      <summary className="flex min-h-11 cursor-pointer items-center font-medium">
        Board numbers (cross-check only)
      </summary>
      <p className="pb-2 text-sm text-zinc-500 dark:text-zinc-400">
        From the ranks board{snap?.boardPulledAt ? `, pulled ${utcStamp(snap.boardPulledAt)}` : ""}.
        Never used in a delta.
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
        <h1 className="text-xl font-bold">{detail.name}</h1>
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">
          {describeInstant(detail.eventAtUtc, getEnv())}
          {quota != null && ` · API quota left ${quota}`}
        </p>
        <div className="mb-4">
          <StatusChips phases={detail.snapshots} />
        </div>
        <StatTable
          leadLabel="Alliance"
          columns={["Members", "Might", "Kills"]}
          rows={rows.map((r) => toStatRow(detail.id, r, names.get(r.unionId)))}
          empty="No snapshot yet. The BEFORE snapshot is taken shortly before the event."
        />
        <BoardSection detail={detail} rows={rows} />
      </main>
    </>
  );
}
