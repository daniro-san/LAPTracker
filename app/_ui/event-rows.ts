// The main page's rows from the event read model (plan Phase 5, 5e): ordered strictly by ledger rank by
// might, each metric as value · delta · percent, kills with the member-loss note when negative, and the
// three ranks (might, kills, server) before → after.
import { delta as computeDelta, rankDelta } from "@/lib/compute";
import type { NameHistoryEntry } from "@/lib/compute";
import type { Dictionary } from "@/lib/copy";
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

/** The newest name seen before the one the row shows (plan §3.8); null for the alliance's first name. */
export function formerlyOf(
  history: NameHistoryEntry[] | undefined,
  tag: string,
  name: string,
): NameHistoryEntry | null {
  const byFirstSeen = [...(history ?? [])].sort(
    (a, b) => a.firstSeen.getTime() - b.firstSeen.getTime(),
  );
  const shown = byFirstSeen.findIndex((e) => e.tag === tag && e.name === name);
  return shown > 0 ? (byFirstSeen[shown - 1] ?? null) : null;
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
function rosterNote(change: RosterChange | undefined, copy: Dictionary): string | undefined {
  if (!change || change.joined === 0 || change.left === 0) return undefined;
  return `${joinedText(change.joined, copy)} · ${leftText(change.left, copy)}`;
}

/** A falling total with members gone: the cause the `*` mark and its legend item name. */
export function fellWithLeavers(delta: number | null, left: number): boolean {
  return delta !== null && delta < 0 && left > 0;
}

/** Kills only fall when people leave (plan Phase 5), so a negative kills delta names the loss. The words
 * sit in the Details panel, not on the Kills row, where all three personas read them as a kills figure
 * (7b); the row carries only the `*` mark. */
function killNote(killsDelta: number | null, change: RosterChange | undefined, copy: Dictionary) {
  if (!change || !fellWithLeavers(killsDelta, change.left)) return undefined;
  return membersLostText(change.left, copy);
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
  copy: Dictionary,
): StatMetric[] {
  const d = computeDelta(pairOf(before), pairOf(after));
  const [b, a] = [figures(before), figures(after)];
  const marked = (delta: number | undefined) => fellWithLeavers(delta ?? null, change?.left ?? 0);
  return [
    {
      ...metric(copy.ledger.might, b.power, a.power, d?.power ?? null),
      memberMark: marked(d?.power),
    },
    {
      ...metric(copy.ledger.kills, b.kills, a.kills, d?.kills ?? null),
      memberMark: marked(d?.kills),
      detailNote: killNote(d?.kills ?? null, change, copy),
    },
    metric(
      copy.ledger.members,
      b.members,
      a.members,
      d ? gap(b.members, a.members) : null,
      d ? rosterNote(change, copy) : undefined,
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
  copy: Dictionary,
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
    const tag = a?.tag ?? b?.tag ?? String(unionId);
    const name = a?.name ?? b?.name ?? "";
    return {
      unionId,
      tag,
      name,
      before: b,
      after: a,
      metrics: metricsFor(b, a, changes.get(unionId), copy),
      formerly: formerlyOf(names.get(unionId), tag, name),
      ranks: rowRanks,
      rank: currentRank(rowRanks.might, after !== undefined),
    };
  });
  const order = (r: ComparisonRow) => r.rank ?? Number.MAX_SAFE_INTEGER;
  return rows.sort((x, y) => order(x) - order(y) || x.tag.localeCompare(y.tag));
}

/** The table's empty line. A manual round (D28) is never run by the tick, so it never promises an automatic update. */
export function emptyLine(manual: boolean, snapshots: number, copy: Dictionary): string {
  if (!manual) return copy.empty.kettle;
  return snapshots === 0 ? copy.empty.manualNotRun : copy.empty.manualNoRows;
}
