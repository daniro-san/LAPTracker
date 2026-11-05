// The main table's rows from the event read model (plan Phase 5): sorted by before.total_power,
// each metric as value · delta · percent, kills with the member-loss note when negative.
import { delta as computeDelta } from "@/lib/compute";
import type { NameHistoryEntry } from "@/lib/compute";
import type { getEventDetail } from "@/lib/queries";
import type { RosterChange } from "@/lib/queries";

import type { StatMetric } from "./StatTable";

type Detail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;
export type Snap = Detail["snapshots"][number];
export type AllianceCell = Snap["alliances"][number];

export interface ComparisonRow {
  unionId: number;
  tag: string;
  name: string;
  before: AllianceCell | undefined;
  after: AllianceCell | undefined;
  metrics: StatMetric[];
  formerly: NameHistoryEntry | null;
}

/** The earlier entry of a name history that is not the current one (plan §3.8). */
export function formerlyOf(history: NameHistoryEntry[] | undefined): NameHistoryEntry | null {
  if (!history || history.length < 2) return null;
  const sorted = [...history].sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  return sorted[1] ?? null;
}

function pairOf(cell: AllianceCell | undefined) {
  return {
    isFresh: cell?.isFresh === true && !cell.failed,
    totalPower: cell?.totalPower ?? null,
    totalKills: cell?.totalKills ?? null,
  };
}

const gap = (from: number | null, to: number | null) =>
  from === null || to === null ? null : to - from;

function metric(
  label: string,
  before: number | null,
  after: number | null,
  delta: number | null,
  note?: string,
): StatMetric {
  return { label, value: after ?? before, delta, base: before, ...(note ? { note } : {}) };
}

/** `+3/−1`: who joined and left, shown only when someone did. */
function rosterNote(change: RosterChange | undefined): string | undefined {
  if (!change || change.joined + change.left === 0) return undefined;
  return `${change.joined} joined, ${change.left} left`;
}

/** Kills only fall when people leave (plan Phase 5), so a negative kills delta names the loss. */
function killNote(killsDelta: number | null, change: RosterChange | undefined) {
  if (killsDelta === null || killsDelta >= 0 || !change || change.left === 0) return undefined;
  return `${change.left} ${change.left === 1 ? "member" : "members"} left`;
}

/** The three compared numbers of one snapshot row; all null when the row is missing. */
function figures(cell: AllianceCell | undefined) {
  return {
    members: cell?.memberCount ?? null,
    power: cell?.totalPower ?? null,
    kills: cell?.totalKills ?? null,
  };
}

function metricsFor(
  before: AllianceCell | undefined,
  after: AllianceCell | undefined,
  change: RosterChange | undefined,
): StatMetric[] {
  const d = computeDelta(pairOf(before), pairOf(after));
  const [b, a] = [figures(before), figures(after)];
  return [
    metric(
      "Members",
      b.members,
      a.members,
      d ? gap(b.members, a.members) : null,
      d ? rosterNote(change) : undefined,
    ),
    metric("Might", b.power, a.power, d?.power ?? null),
    metric("Kills", b.kills, a.kills, d?.kills ?? null, killNote(d?.kills ?? null, change)),
  ];
}

/** One row per tracked alliance seen in either snapshot, biggest before.total_power first. */
export function comparisonRows(
  snapshots: Snap[],
  changes: Map<number, RosterChange>,
  names: Map<number, NameHistoryEntry[]>,
): ComparisonRow[] {
  const before = snapshots.find((s) => s.phase === "before");
  const after = snapshots.find((s) => s.phase === "after");
  const ids = new Set(
    [...(before?.alliances ?? []), ...(after?.alliances ?? [])].map((a) => a.unionId),
  );
  const rows = [...ids].map((unionId) => {
    const b = before?.alliances.find((a) => a.unionId === unionId);
    const a = after?.alliances.find((x) => x.unionId === unionId);
    return {
      unionId,
      tag: a?.tag ?? b?.tag ?? String(unionId),
      name: a?.name ?? b?.name ?? "",
      before: b,
      after: a,
      metrics: metricsFor(b, a, changes.get(unionId)),
      formerly: formerlyOf(names.get(unionId)),
    };
  });
  const power = (r: ComparisonRow) => r.before?.totalPower ?? r.after?.totalPower ?? -1;
  return rows.sort((x, y) => power(y) - power(x));
}
