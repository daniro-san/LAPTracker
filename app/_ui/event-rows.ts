// The main page's rows from the event read model (plan Phase 5, 5e): ordered strictly by ledger rank by
// might, each metric as value · delta · percent, kills with the member-loss note when negative, and the
// three ranks (might, kills, server) before → after.
import { delta as computeDelta, rankDelta, windowedStart } from "@/lib/compute";
import type { NameHistoryEntry } from "@/lib/compute";
import type { Dictionary } from "@/lib/copy";
import type { getEventDetail, Ranks, RosterChange } from "@/lib/queries";
import type { EventTotals } from "@/lib/queries/events";
import type { MemberShare } from "@/lib/queries/rosters";

import type { RankPair } from "./DetailLines";
import { membersLostText } from "./format";
import type { MetricSplit } from "./SplitMark";
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
): StatMetric {
  return { label, value: after ?? before, delta, base: before };
}

/** `+3 joined · −1 left` (StatTable writes and links it), only when people both joined and left: otherwise
 * the change says it all. */
function rosterNote(change: RosterChange | undefined): Pick<StatMetric, "roster"> {
  if (!change || change.joined === 0 || change.left === 0) return {};
  return { roster: { joined: change.joined, left: change.left } };
}

/** A falling total with members gone: the cause the `*` mark and its legend item name. */
export function fellWithLeavers(delta: number | null, left: number): boolean {
  return delta !== null && delta < 0 && left > 0;
}

/**
 * What the members who joined and left moved in a change (D69 amendment, 2026-11-21), for its tappable mark;
 * undefined when there is no change or they moved nothing. The change stays the alliance's total.
 */
export function splitOf(
  delta: number | null | undefined,
  change: RosterChange | undefined,
  share: (c: RosterChange) => MemberShare,
): MetricSplit | undefined {
  if (delta == null || !change) return undefined;
  const { joined, left } = share(change);
  if (joined === 0 && left === 0) return undefined;
  return { joined: { n: change.joined, value: joined }, left: { n: change.left, value: left } };
}

/** The Might or Kills metric: the `*` of a fall with leavers, or the split when the roster moved it. */
export function markOf(
  delta: number | null | undefined,
  change: RosterChange | undefined,
  share: (c: RosterChange) => MemberShare,
): Pick<StatMetric, "memberMark" | "split"> {
  const split = splitOf(delta, change, share);
  return split ? { split } : { memberMark: fellWithLeavers(delta ?? null, change?.left ?? 0) };
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

/** `between`: this alliance's rows between the event's windows (D160); the change is the sum of its
 * windows' changes. Empty for a one-window event. */
function metricsFor(
  before: AllianceCell | undefined,
  after: AllianceCell | undefined,
  change: RosterChange | undefined,
  copy: Dictionary,
  between: readonly (AllianceCell | undefined)[] = [],
): StatMetric[] {
  const d = computeDelta(windowedStart(pairOf(before), between.map(pairOf)), pairOf(after));
  const [b, a] = [figures(before), figures(after)];
  return [
    {
      ...metric(copy.ledger.might, b.power, a.power, d?.power ?? null),
      ...markOf(d?.power, change, (c) => c.power),
    },
    {
      ...metric(copy.ledger.kills, b.kills, a.kills, d?.kills ?? null),
      ...markOf(d?.kills, change, (c) => c.kills),
      detailNote: killNote(d?.kills ?? null, change, copy),
    },
    {
      ...metric(copy.ledger.members, b.members, a.members, d ? gap(b.members, a.members) : null),
      ...(d ? rosterNote(change) : {}),
    },
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

/** One row per alliance seen in either snapshot, by ledger rank by might (#1 first, unranked last).
 * `between`: the event detail's rows between windows (D160); none for a one-window event. */
export function comparisonRows(
  snapshots: Snap[],
  changes: Map<number, RosterChange>,
  names: Map<number, NameHistoryEntry[]>,
  ranks: Map<number, Partial<Record<"before" | "after", Ranks>>>,
  copy: Dictionary,
  between: readonly { alliances: readonly AllianceCell[] }[] = [],
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
      metrics: metricsFor(
        b,
        a,
        changes.get(unionId),
        copy,
        between.map((s) => s.alliances.find((x) => x.unionId === unionId)),
      ),
      formerly: formerlyOf(names.get(unionId), tag, name),
      ranks: rowRanks,
      rank: currentRank(rowRanks.might, after !== undefined),
    };
  });
  const order = (r: ComparisonRow) => r.rank ?? Number.MAX_SAFE_INTEGER;
  // Rows without a rank (no End yet) go by size: the newest might read, biggest first (panel PD-3).
  const might = (r: ComparisonRow) => r.after?.totalPower ?? r.before?.totalPower ?? -1;
  return rows.sort(
    (x, y) => order(x) - order(y) || might(y) - might(x) || x.tag.localeCompare(y.tag),
  );
}

/** A change since the previous event at least this big (of the earlier figure) shows its own line; for
 * Members, also at least BIG_MEMBERS people, so 2 of 8 leaving does not light up a row (D75). */
export const BIG_STEP = 0.25;
export const BIG_MEMBERS = 5;

/**
 * The ledger row's "since Nov 7" line (issue 473): the change since the previous event's reference reading,
 * under each figure, only when Might or Members moved by BIG_STEP or more since then (an alliance of 93
 * members with 1 left reads `= 0` inside the event). `fresh`: the row's own figures were read fresh; a
 * stale side has no change (INVARIANT freshness.no-stale-delta). Metrics are Might, Kills, Members.
 */
export function withSinceLast(
  metrics: StatMetric[],
  previous: EventTotals | undefined,
  fresh: boolean,
  label: string,
): StatMetric[] {
  if (!previous || !fresh) return metrics;
  const was = [previous.power, previous.kills, previous.members];
  const big = (i: number) => {
    const [now, then] = [metrics[i]?.value ?? null, was[i] ?? null];
    if (now === null || then === null || then <= 0) return false;
    return (
      Math.abs(now - then) / then >= BIG_STEP && (i !== 2 || Math.abs(now - then) >= BIG_MEMBERS)
    );
  };
  if (!big(0) && !big(2)) return metrics;
  return metrics.map((m, i) => {
    const then = was[i] ?? null;
    if (m.value === null || then === null) return m;
    return { ...m, vs: { label, delta: m.value - then, base: then } };
  });
}

/** The table's empty line. A manual round (D28) is never run by the tick, so it never promises an automatic update. */
export function emptyLine(manual: boolean, snapshots: number, copy: Dictionary): string {
  if (!manual) return copy.empty.kettle;
  return snapshots === 0 ? copy.empty.manualNotRun : copy.empty.manualNoRows;
}
