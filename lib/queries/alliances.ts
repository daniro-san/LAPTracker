// Read models for the alliance page (plan Phase 5c, 5e). Served member fields: uid, name, power,
// kills, lv only (§12.1), plus whether a photo exists (never its URL, D22); raw_json is never selected.
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { delta, rosterDiff, seriesDeltas, type SeriesStep } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import { rolesOf, type Role } from "./leadership";
import { historyRanks, type Ranks } from "./ranks";
import { chainEvent, publicEvent } from "./visibility";

export interface AllianceRow {
  id: number;
  phase: "before" | "after";
  tag: string | null;
  name: string | null;
  badgeId: number | null;
  memberCount: number | null;
  /** The most members the alliance can hold; null on rows stored before the column existed. */
  capacity: number | null;
  totalPower: number | null;
  totalKills: number | null;
  serverRank: number | null;
  isFresh: boolean;
  sourceUpdatedAt: Date | null;
  failed: boolean;
}

export interface MemberRow {
  uid: number;
  name: string;
  power: number | null;
  kills: number | null;
  lv: number | null;
  /** /img/avatar/[uid] has a photo to serve. */
  hasAvatar: boolean;
}

const allianceColumns = {
  id: allianceSnapshots.id,
  tag: allianceSnapshots.tag,
  name: allianceSnapshots.name,
  badgeId: allianceSnapshots.badgeId,
  memberCount: allianceSnapshots.memberCount,
  capacity: allianceSnapshots.capacity,
  totalPower: allianceSnapshots.totalPower,
  totalKills: allianceSnapshots.totalKills,
  serverRank: allianceSnapshots.serverRank,
  isFresh: allianceSnapshots.isFresh,
  sourceUpdatedAt: allianceSnapshots.sourceUpdatedAt,
  error: allianceSnapshots.error,
};

const toRow = ({ error, ...row }: Omit<AllianceRow, "failed"> & { error: string | null }) => ({
  ...row,
  failed: error !== null,
});

async function membersOf(db: Db, allianceSnapshotIds: number[]) {
  if (allianceSnapshotIds.length === 0) return [];
  return db
    .select({
      allianceSnapshotId: memberSnapshots.allianceSnapshotId,
      uid: memberSnapshots.uid,
      name: memberSnapshots.name,
      power: memberSnapshots.power,
      kills: memberSnapshots.kills,
      lv: memberSnapshots.lv,
      hasAvatar: sql<boolean>`${memberSnapshots.avatarUrl} is not null`,
    })
    .from(memberSnapshots)
    .where(inArray(memberSnapshots.allianceSnapshotId, allianceSnapshotIds));
}

/** One alliance in one event: its before and after rows and both rosters. Null for a test event. */
export async function getAllianceDetail(db: Db, eventId: number, unionId: number) {
  const rows = await db
    .select({ ...allianceColumns, phase: snapshots.phase })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(and(eq(events.id, eventId), publicEvent, eq(allianceSnapshots.unionId, unionId)));
  if (rows.length === 0) return null;
  const alliances = rows.map(toRow);
  const ids = alliances.map((a) => a.id);
  const [members, roles] = await Promise.all([membersOf(db, ids), rolesOf(db, ids)]);
  const roleMapOf = (phase: "before" | "after") => {
    const id = alliances.find((a) => a.phase === phase)?.id;
    return (id === undefined ? undefined : roles.get(id)) ?? new Map<number, Role>();
  };
  const rosterOf = (phase: "before" | "after"): MemberRow[] => {
    const id = alliances.find((a) => a.phase === phase)?.id;
    return members
      .filter((m) => m.allianceSnapshotId === id)
      .map(({ allianceSnapshotId: _, ...m }) => m);
  };
  return {
    before: alliances.find((a) => a.phase === "before") ?? null,
    after: alliances.find((a) => a.phase === "after") ?? null,
    membersBefore: rosterOf("before"),
    membersAfter: rosterOf("after"),
    /** R5 and titled R4 members by uid, as each snapshot's alliance read lists them. */
    rolesBefore: roleMapOf("before"),
    rolesAfter: roleMapOf("after"),
  };
}

export interface HistoryRow {
  eventId: number;
  eventName: string;
  eventAtUtc: Date;
  /** `before` marks the fallback: the after snapshot is missing or has no data (Phase 5e). */
  reference: "before" | "after";
  /** When the reference row's data was read upstream: the time its figures are from. */
  updatedAt: Date | null;
  tag: string | null;
  name: string | null;
  memberCount: number | null;
  totalPower: number | null;
  totalKills: number | null;
  serverRank: number | null;
  /** Ledger ranks among every tracked alliance's reference row of the event. */
  ledger: Ranks | null;
  isFresh: boolean;
  step: SeriesStep;
  /** Members who joined / left since the previous event's reference; null when either is stale. */
  joined: number | null;
  left: number | null;
  previous: { tag: string | null; name: string | null } | null;
  /** The event's before → after change, with when the before was read and how many of its members left;
   * null unless both rows exist, are fresh and did not fail (INVARIANT freshness.no-stale-delta). */
  inEvent: {
    fromAt: Date | null;
    fromPower: number;
    fromKills: number;
    power: number;
    kills: number;
    members: number | null;
    left: number;
  } | null;
}

const fresh = (row: AllianceRow | undefined) => ({
  isFresh: row !== undefined && row.isFresh && !row.failed,
  totalPower: row?.totalPower ?? null,
  totalKills: row?.totalKills ?? null,
});

type Pair = { b: AllianceRow; a: AllianceRow; change: { power: number; kills: number } };

/** Each event's before and after rows with their change, when both are usable. */
function inEventPairs(
  rows: { eventId: number; phase: "before" | "after"; row: AllianceRow }[],
  eventIds: number[],
): Map<number, Pair> {
  const sideOf = (eventId: number, phase: "before" | "after") =>
    rows.find((r) => r.eventId === eventId && r.phase === phase)?.row;
  return new Map(
    eventIds.flatMap((eventId) => {
      const [b, a] = [sideOf(eventId, "before"), sideOf(eventId, "after")];
      const change = delta(fresh(b), fresh(a));
      return b && a && change ? [[eventId, { b, a, change }] as const] : [];
    }),
  );
}

function inEventOf(
  { b, a, change }: Pair,
  rosterOf: (id: number) => { uid: number; name: string }[],
): HistoryRow["inEvent"] {
  return {
    fromAt: b.sourceUpdatedAt,
    // delta() gave a change, so both totals are non-null.
    fromPower: b.totalPower as number,
    fromKills: b.totalKills as number,
    ...change,
    members:
      a.memberCount !== null && b.memberCount !== null ? a.memberCount - b.memberCount : null,
    left: rosterDiff(rosterOf(b.id), rosterOf(a.id)).left.length,
  };
}

/** The after row, or the before row when after is missing or failed (Phase 5e). */
function pickReferences(
  rows: { eventId: number; phase: "before" | "after"; row: AllianceRow }[],
): Map<number, { reference: "before" | "after"; row: AllianceRow }> {
  const picked = new Map<number, { reference: "before" | "after"; row: AllianceRow }>();
  for (const { eventId, phase, row } of rows) {
    const usable = !row.failed && row.totalPower !== null;
    const current = picked.get(eventId);
    if (usable && (!current || phase === "after")) picked.set(eventId, { reference: phase, row });
  }
  return picked;
}

/** The alliance's reference row per event, oldest first, with deltas vs the previous event. */
export async function allianceHistory(db: Db, unionId: number): Promise<HistoryRow[]> {
  const found = await db
    .select({
      ...allianceColumns,
      phase: snapshots.phase,
      eventId: events.id,
      eventName: events.name,
      eventAtUtc: events.eventAtUtc,
    })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(and(eq(allianceSnapshots.unionId, unionId), chainEvent))
    .orderBy(asc(events.eventAtUtc));
  const meta = new Map(found.map((r) => [r.eventId, r]));
  const rows = found.map((r) => ({ eventId: r.eventId, phase: r.phase, row: toRow(r) }));
  const picked = pickReferences(rows);
  const pairs = inEventPairs(rows, [...picked.keys()]);
  const ordered = [...picked].sort(
    ([a], [b]) =>
      (meta.get(a)?.eventAtUtc.getTime() ?? 0) - (meta.get(b)?.eventAtUtc.getTime() ?? 0),
  );
  const [rosters, ranks] = await Promise.all([
    membersOf(db, [...ordered.map(([, p]) => p.row.id), ...[...pairs.values()].map((p) => p.b.id)]),
    historyRanks(db),
  ]);
  const steps = seriesDeltas(
    ordered.map(([, { row }]) => ({
      isFresh: row.isFresh,
      power: row.totalPower,
      kills: row.totalKills,
      lv: null,
      name: row.name,
      tag: row.tag,
      unionId,
    })),
  );
  const ledgerOf = (eventId: number) => ranks.get(eventId)?.get(unionId) ?? null;
  return ordered.flatMap(([eventId, { reference, row }], i) => {
    const event = meta.get(eventId);
    if (!event) return [];
    const prev = i > 0 ? ordered[i - 1] : undefined;
    const rosterOfRow = (id: number) => rosters.filter((m) => m.allianceSnapshotId === id);
    const diff =
      prev && prev[1].row.isFresh && row.isFresh
        ? rosterDiff(rosterOfRow(prev[1].row.id), rosterOfRow(row.id))
        : null;
    const pair = pairs.get(eventId);
    return [
      {
        eventId,
        eventName: event.eventName,
        eventAtUtc: event.eventAtUtc,
        reference,
        updatedAt: row.sourceUpdatedAt,
        tag: row.tag,
        name: row.name,
        memberCount: row.memberCount,
        totalPower: row.totalPower,
        totalKills: row.totalKills,
        serverRank: row.serverRank,
        ledger: ledgerOf(eventId),
        isFresh: row.isFresh,
        step: steps[i] as SeriesStep,
        joined: diff?.joined.length ?? null,
        left: diff?.left.length ?? null,
        previous: prev ? { tag: prev[1].row.tag, name: prev[1].row.name } : null,
        inEvent: pair ? inEventOf(pair, rosterOfRow) : null,
      },
    ];
  });
}
