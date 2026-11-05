// The main page's rows from the event read model (plan Phase 5, 5e): ordered strictly by ledger rank by
// might, each metric as value · delta · percent, kills with the member-loss note when negative, and the
// three ranks (might, kills, server) before → after.
import { delta as computeDelta, rankDelta } from "@/lib/compute";
import type { NameHistoryEntry } from "@/lib/compute";
import { copy } from "@/lib/copy";
import type { getEventDetail, Ranks, RosterChange } from "@/lib/queries";

import type { RankPair } from "./DetailLines";
import { joinedText, leftText, membersLostText } from "./format";
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
  ranks: { might: RankPair; kills: RankPair; server: RankPair };
  /** The rank the page shows and sorts by; null when the after snapshot ran without ranking it. */
  rank: number | null;
}

/** The earlier entry of a name history that is not the current one (plan §3.8). */
export function formerlyOf(history: NameHistoryEntry[] | undefined): NameHistoryEntry | null {
  if (!history || history.length < 2) return null;
  const sorted = [...history].sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  return sorted[1] ?? null;
}

const usable = (cell: AllianceCell | undefined) => cell?.isFresh === true && !cell.failed;

function pairOf(cell: AllianceCell | undefined) {
  return {
    isFresh: usable(cell),
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

/** `+3 joined · −1 left`, only when people both joined and left: otherwise the change says it all. */
function rosterNote(change: RosterChange | undefined): string | undefined {
  if (!change || change.joined === 0 || change.left === 0) return undefined;
  return `${joinedText(change.joined)} · ${leftText(change.left)}`;
}

/** Kills only fall when people leave (plan Phase 5), so a negative kills delta names the loss. It sits in
 * the Details panel, not on the Kills row, where all three personas read it as a kills figure (7b). */
function killNote(killsDelta: number | null, change: RosterChange | undefined) {
  if (killsDelta === null || killsDelta >= 0 || !change || change.left === 0) return undefined;
  return membersLostText(change.left);
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
    metric(copy.ledger.might, b.power, a.power, d?.power ?? null),
    {
      ...metric(copy.ledger.kills, b.kills, a.kills, d?.kills ?? null),
      detailNote: killNote(d?.kills ?? null, change),
    },
    metric(
      copy.ledger.members,
      b.members,
      a.members,
      d ? gap(b.members, a.members) : null,
      d ? rosterNote(change) : undefined,
    ),
  ];
}

function rankPair(before: number | null, after: number | null, canMove: boolean): RankPair {
  return { before, after, move: canMove ? rankDelta(before, after) : null };
}

function ranksFor(
  b: AllianceCell | undefined,
  a: AllianceCell | undefined,
  ledger: Partial<Record<"before" | "after", Ranks>> = {},
) {
  const canMove = usable(b) && usable(a);
  const pair = (key: keyof Ranks) =>
    rankPair(ledger.before?.[key] ?? null, ledger.after?.[key] ?? null, canMove);
  return {
    might: pair("might"),
    kills: pair("kills"),
    server: rankPair(b?.serverRank ?? null, a?.serverRank ?? null, canMove),
  };
}

/**
 * The rank of the latest snapshot that ran: the after rank once the after snapshot exists, else the
 * before rank. An alliance whose after fetch failed gets no rank rather than its old one, which another
 * alliance may hold now (07c S8); its before rank stays in Details.
 */
export const currentRank = (r: RankPair, afterRan: boolean): number | null =>
  afterRan ? r.after : r.before;

/**
 * When the page's numbers next change: this event's first snapshot that has not run, while its time is
 * still ahead; otherwise the next snapshot on the schedule (`scheduled`, from lib/schedule nextEvent).
 * So a finished or past event still says when the next update comes (owner, 2026-11-05).
 */
export function nextUpdateAt(
  ran: ("before" | "after")[],
  event: { beforeAt: Date; afterAt: Date },
  scheduled: { beforeAt: Date; afterAt: Date },
  now: Date,
): Date | null {
  const pending = (["before", "after"] as const)
    .filter((ph) => !ran.includes(ph))
    .map((ph) => (ph === "before" ? event.beforeAt : event.afterAt))
    .find((at) => at > now);
  if (pending) return pending;
  return [scheduled.beforeAt, scheduled.afterAt].find((at) => at > now) ?? null;
}

/** One row per alliance seen in either snapshot, by ledger rank by might (#1 first, unranked last). */
export function comparisonRows(
  snapshots: Snap[],
  changes: Map<number, RosterChange>,
  names: Map<number, NameHistoryEntry[]>,
  ranks: Map<number, Partial<Record<"before" | "after", Ranks>>>,
): ComparisonRow[] {
  const before = snapshots.find((s) => s.phase === "before");
  const after = snapshots.find((s) => s.phase === "after");
  const ids = new Set(
    [...(before?.alliances ?? []), ...(after?.alliances ?? [])].map((a) => a.unionId),
  );
  const rows = [...ids].map((unionId) => {
    const b = before?.alliances.find((a) => a.unionId === unionId);
    const a = after?.alliances.find((x) => x.unionId === unionId);
    const rowRanks = ranksFor(b, a, ranks.get(unionId));
    return {
      unionId,
      tag: a?.tag ?? b?.tag ?? String(unionId),
      name: a?.name ?? b?.name ?? "",
      before: b,
      after: a,
      metrics: metricsFor(b, a, changes.get(unionId)),
      formerly: formerlyOf(names.get(unionId)),
      ranks: rowRanks,
      rank: currentRank(rowRanks.might, after !== undefined),
    };
  });
  const order = (r: ComparisonRow) => r.rank ?? Number.MAX_SAFE_INTEGER;
  return rows.sort((x, y) => order(x) - order(y) || x.tag.localeCompare(y.tag));
}
