// Event vs event (#177, D57): two events' in-event changes side by side, per alliance and, for one
// alliance, per member. Each event gives, per alliance or member, its in-event change (compute.delta:
// none when a side is missing, stale or failed) and its reference value (after, else before). Member
// fields served: uid, name, power, kills (§12.1); raw_json and avatar_url are never selected.
import { and, eq, inArray, sql } from "drizzle-orm";

import { delta, rankDelta, rosterDiff, type Measured } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, memberSnapshots } from "../schema";
import { getEventDetail, homeEvent, listEvents, type EventSummary } from "./events";
import { eventRanks, type Ranks } from "./ranks";

export type Detail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;
type Snapshot = Detail["snapshots"][number];
type Side = Snapshot["alliances"][number];
type Change = { power: number; kills: number };

/** Whether one snapshot side was readable: what the page's freshness mark shows. */
export interface SideState {
  isFresh: boolean;
  failed: boolean;
}

/** One alliance in one event. */
export interface AllianceEventFigures {
  /** The in-event change of might and kills; null when a side is missing, stale or failed. */
  change: Change | null;
  /** The before values, for the percent. */
  opening: { power: number | null; kills: number | null };
  /** Members after − before, with whoever left during the event; null without a change. */
  members: { change: number | null; left: number | null };
  /** Ledger rank by might at the after snapshot, and its move from before (null without a change). */
  rank: { n: number | null; move: number | null };
  /** The after row, else the before row, when it holds data. */
  reference: { power: number | null; kills: number | null; members: number | null } | null;
  before: SideState | null;
  after: SideState | null;
}

export interface AllianceComparison {
  unionId: number;
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  a: AllianceEventFigures | null;
  b: AllianceEventFigures | null;
  /** Members who joined or left from A's reference roster to B's; null unless both are usable. */
  between: { joined: number; left: number } | null;
}

export interface MemberComparison {
  uid: number;
  name: string;
  /** /img/avatar/[uid] has a photo to serve (never its URL, D22). */
  hasAvatar: boolean;
  /** Null: the member is in neither of the alliance's rosters of that event. */
  a: { power: number | null; change: Change | null; opening: Change | null } | null;
  b: { power: number | null; change: Change | null; opening: Change | null } | null;
}

interface RosterRow {
  snapshotId: number;
  unionId: number;
  uid: number;
  name: string;
  power: number | null;
  kills: number | null;
  hasAvatar: boolean;
}

export const usable = (s: Side | undefined) => s !== undefined && !s.failed && s.isFresh;
const measured = (s: Side): Measured => ({
  isFresh: usable(s),
  totalPower: s.totalPower,
  totalKills: s.totalKills,
});

/** The event's two snapshots and each alliance's row in them. */
export function sidesOf(detail: Detail) {
  const before = detail.snapshots.find((s) => s.phase === "before");
  const after = detail.snapshots.find((s) => s.phase === "after");
  const row = (s: Snapshot | undefined, unionId: number) =>
    s?.alliances.find((x) => x.unionId === unionId);
  return { before, after, row };
}

/** The snapshot whose roster is the alliance's reference in this event (Phase 5e). */
function referenceSnapshot(detail: Detail, unionId: number): Snapshot | undefined {
  const { before, after, row } = sidesOf(detail);
  const a = row(after, unionId);
  return a && !a.failed && a.totalPower !== null ? after : before;
}

const uidsOf = (rows: RosterRow[], snapshotId: number | undefined, unionId: number) =>
  rows
    .filter((r) => r.snapshotId === snapshotId && r.unionId === unionId)
    .map((r) => ({ uid: r.uid, name: r.name }));

const stateOf = (s: Side | undefined): SideState | null =>
  s ? { isFresh: s.isFresh, failed: s.failed } : null;

const minus = (a: number | null, b: number | null) => (a === null || b === null ? null : a - b);

/** The usable before and after rows, or null: the pair a change is measured on. */
function changedPair(b: Side | undefined, a: Side | undefined) {
  if (!a || !b) return null;
  const change = delta(measured(b), measured(a));
  return change ? { b, a, change } : null;
}

function allianceFigures(
  detail: Detail,
  ranks: Map<number, Partial<Record<"before" | "after", Ranks>>>,
  rosters: RosterRow[],
  unionId: number,
): AllianceEventFigures | null {
  const { before, after, row } = sidesOf(detail);
  const b = row(before, unionId);
  const a = row(after, unionId);
  if (!a && !b) return null;
  const pair = changedPair(b, a);
  const refRow = row(referenceSnapshot(detail, unionId), unionId);
  const roster = (s: Snapshot | undefined) => uidsOf(rosters, s?.id, unionId);
  return {
    change: pair ? pair.change : null,
    opening: openingOf(b),
    members: pair
      ? {
          change: minus(pair.a.memberCount, pair.b.memberCount),
          left: rosterDiff(roster(before), roster(after)).left.length,
        }
      : { change: null, left: null },
    rank: rankOf(ranks.get(unionId), pair !== null),
    reference: refRow && !refRow.failed ? referenceOf(refRow) : null,
    before: stateOf(b),
    after: stateOf(a),
  };
}

const openingOf = (b: Side | undefined) => ({
  power: b ? b.totalPower : null,
  kills: b ? b.totalKills : null,
});

/** The ledger rank by might at after; it moves only when the event has a change. */
function rankOf(r: Partial<Record<"before" | "after", Ranks>> | undefined, moved: boolean) {
  const after = r?.after?.might ?? null;
  return { n: after, move: moved ? rankDelta(r?.before?.might, after) : null };
}

const referenceOf = (s: Side) => ({
  power: s.totalPower,
  kills: s.totalKills,
  members: s.memberCount,
});

/** Joined and left from A's reference roster to B's, when both reference rows are usable. */
function betweenOf(a: Detail, b: Detail, rosters: RosterRow[], unionId: number) {
  const [sa, sb] = [referenceSnapshot(a, unionId), referenceSnapshot(b, unionId)];
  const rowA = sidesOf(a).row(sa, unionId);
  const rowB = sidesOf(b).row(sb, unionId);
  if (!usable(rowA) || !usable(rowB)) return null;
  const diff = rosterDiff(uidsOf(rosters, sa?.id, unionId), uidsOf(rosters, sb?.id, unionId));
  return { joined: diff.joined.length, left: diff.left.length };
}

/** One member's side in one event, read in this alliance's rosters only. */
function memberSide(detail: Detail, rosters: RosterRow[], unionId: number, uid: number) {
  const { before, after, row } = sidesOf(detail);
  const find = (s: Snapshot | undefined) =>
    rosters.find((r) => r.snapshotId === s?.id && r.unionId === unionId && r.uid === uid);
  const [mb, ma] = [find(before), find(after)];
  if (!mb && !ma) return null;
  const side = (m: RosterRow, s: Side | undefined): Measured => ({
    isFresh: usable(s),
    totalPower: m.power,
    totalKills: m.kills,
  });
  const both = mb && ma ? { b: mb, a: ma } : null;
  return {
    power: (ma ?? mb)?.power ?? null,
    change: both
      ? delta(side(both.b, row(before, unionId)), side(both.a, row(after, unionId)))
      : null,
    opening: both ? { power: both.b.power ?? 0, kills: both.b.kills ?? 0 } : null,
  };
}

function membersOf(a: Detail, b: Detail, rosters: RosterRow[], unionId: number) {
  // The member's name and photo as the second event's roster has them, else the first's.
  const inB = new Set(b.snapshots.map((s) => s.id));
  const latest = new Map<number, RosterRow>();
  for (const r of rosters) if (!latest.has(r.uid) || inB.has(r.snapshotId)) latest.set(r.uid, r);
  return [...latest.values()]
    .map(({ uid, name, hasAvatar }): MemberComparison => ({
      uid,
      name,
      hasAvatar,
      a: memberSide(a, rosters, unionId, uid),
      b: memberSide(b, rosters, unionId, uid),
    }))
    .sort(
      (x, y) =>
        (y.b?.power ?? y.a?.power ?? -1) - (x.b?.power ?? x.a?.power ?? -1) || x.uid - y.uid,
    );
}

/** Sums over the alliances with a change in BOTH events (owner, 2026-11-08), so A and B cover one set. */
export function compareTotals(alliances: AllianceComparison[]) {
  const both = alliances.filter((r) => r.a?.change && r.b?.change);
  const sum = (pick: (f: AllianceEventFigures) => number | null, k: "a" | "b") =>
    both.reduce((t, r) => t + (pick(r[k] as AllianceEventFigures) ?? 0), 0);
  const side = (k: "a" | "b") => ({
    power: sum((f) => f.change?.power ?? null, k),
    kills: sum((f) => f.change?.kills ?? null, k),
    members: sum((f) => f.members.change, k),
    openingPower: sum((f) => f.opening.power, k),
    openingKills: sum((f) => f.opening.kills, k),
  });
  return { counted: both.length, of: alliances.length, a: side("a"), b: side("b") };
}

async function rostersOf(db: Db, snapshotIds: number[], unionId?: number): Promise<RosterRow[]> {
  if (snapshotIds.length === 0) return [];
  const where = inArray(allianceSnapshots.snapshotId, snapshotIds);
  return db
    .select({
      snapshotId: allianceSnapshots.snapshotId,
      unionId: allianceSnapshots.unionId,
      uid: memberSnapshots.uid,
      name: memberSnapshots.name,
      power: memberSnapshots.power,
      kills: memberSnapshots.kills,
      hasAvatar: sql<boolean>`${memberSnapshots.avatarUrl} is not null`,
    })
    .from(memberSnapshots)
    .innerJoin(allianceSnapshots, eq(allianceSnapshots.id, memberSnapshots.allianceSnapshotId))
    .where(unionId === undefined ? where : and(where, eq(allianceSnapshots.unionId, unionId)));
}

/** An event as the page shows it: its snapshots without their alliance rows. */
export const eventOf = ({ snapshots, ...e }: Detail) => ({
  ...e,
  snapshots: snapshots.map(({ alliances: _, ...s }) => s),
});

const rankOrder = (r: AllianceComparison) => r.b?.rank.n ?? r.a?.rank.n ?? Infinity;

/** Two public events compared; `unionId` narrows to one alliance and adds its members. Null: an id is
 * not a public event, or the alliance is in neither. */
export async function compareEvents(db: Db, aId: number, bId: number, unionId?: number) {
  const [a, b] = await Promise.all([getEventDetail(db, aId), getEventDetail(db, bId)]);
  if (!a || !b) return null;
  const snapshotIds = [...a.snapshots, ...b.snapshots].map((s) => s.id);
  const [ranksA, ranksB, rosters] = await Promise.all([
    eventRanks(db, aId),
    eventRanks(db, bId),
    rostersOf(db, snapshotIds, unionId),
  ]);
  const ids = new Set(
    [a, b].flatMap((d) => d.snapshots.flatMap((s) => s.alliances.map((x) => x.unionId))),
  );
  const label = (u: number) =>
    [b, a].flatMap((d) => d.snapshots.flatMap((s) => s.alliances)).find((x) => x.unionId === u);
  const alliances = [...ids]
    .filter((u) => unionId === undefined || u === unionId)
    .map((u): AllianceComparison => {
      const l = label(u);
      return {
        unionId: u,
        tag: l?.tag ?? null,
        name: l?.name ?? null,
        badgeId: l?.badgeId ?? null,
        a: allianceFigures(a, ranksA, rosters, u),
        b: allianceFigures(b, ranksB, rosters, u),
        between: betweenOf(a, b, rosters, u),
      };
    })
    .sort((x, y) => rankOrder(x) - rankOrder(y) || x.unionId - y.unionId);
  if (unionId !== undefined && alliances.length === 0) return null;
  return {
    a: eventOf(a),
    b: eventOf(b),
    alliances,
    totals: compareTotals(alliances),
    members: unionId === undefined ? null : membersOf(a, b, rosters, unionId),
  };
}

export type EventComparison = NonNullable<Awaited<ReturnType<typeof compareEvents>>>;

/** An event a viewer can compare: one with a complete or partial snapshot. */
export const comparable = (e: Pick<EventSummary, "snapshots">) =>
  e.snapshots.some((s) => s.status === "complete" || s.status === "partial");

/** The events the picker can pick, then A and B: B defaults to the home event, A to the newest event
 * with data before B. Shared by the alliance view and the player view (issue 199). */
export async function comparePicks(db: Db, ids: { a: number | null; b: number | null }) {
  const events = await listEvents(db);
  const homeId = homeEvent(events)?.id ?? null;
  const b = ids.b ?? homeId;
  const bAt = events.find((e) => e.id === b)?.eventAtUtc;
  const older = events.filter((e) => comparable(e) && bAt !== undefined && e.eventAtUtc < bAt);
  const a = ids.a ?? older[0]?.id ?? null;
  /** The picker's options: every comparable event, plus A and B if they were given without data. */
  const choices = events.filter((e) => comparable(e) || e.id === a || e.id === b);
  return { events, homeId, choices, a, b };
}

/**
 * The compare page's data (D57). `comparison` is null when A and B are the same or there is no A;
 * `found` is false when an id given is not a public event (or the alliance is in neither).
 */
export async function getComparePage(
  db: Db,
  ids: { a: number | null; b: number | null; unionId: number | null },
) {
  const base = await comparePicks(db, ids);
  const { a, b } = base;
  if (a === null || b === null || a === b) return { ...base, found: true, comparison: null };
  const comparison = await compareEvents(db, a, b, ids.unionId ?? undefined);
  return { ...base, found: comparison !== null, comparison };
}
