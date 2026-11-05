// Read models for the alliance page (plan Phase 5c, 5e). Served member fields: uid, name, power,
// kills, lv only (§12.1); raw_json is never selected.
import { and, asc, eq, inArray } from "drizzle-orm";

import { rosterDiff, seriesDeltas, type SeriesStep } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";

export interface AllianceRow {
  id: number;
  phase: "before" | "after";
  tag: string | null;
  name: string | null;
  memberCount: number | null;
  totalPower: number | null;
  totalKills: number | null;
  serverRank: number | null;
  level: number | null;
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
}

const allianceColumns = {
  id: allianceSnapshots.id,
  tag: allianceSnapshots.tag,
  name: allianceSnapshots.name,
  memberCount: allianceSnapshots.memberCount,
  totalPower: allianceSnapshots.totalPower,
  totalKills: allianceSnapshots.totalKills,
  serverRank: allianceSnapshots.serverRank,
  level: allianceSnapshots.level,
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
    .where(
      and(eq(events.id, eventId), eq(events.isTest, false), eq(allianceSnapshots.unionId, unionId)),
    );
  if (rows.length === 0) return null;
  const alliances = rows.map(toRow);
  const members = await membersOf(
    db,
    alliances.map((a) => a.id),
  );
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
  };
}

export interface HistoryRow {
  eventId: number;
  eventName: string;
  eventAtUtc: Date;
  /** `before` marks the fallback: the after snapshot is missing or has no data (Phase 5e). */
  reference: "before" | "after";
  tag: string | null;
  name: string | null;
  memberCount: number | null;
  totalPower: number | null;
  totalKills: number | null;
  level: number | null;
  serverRank: number | null;
  isFresh: boolean;
  step: SeriesStep;
  /** Members who joined / left since the previous event's reference; null when either is stale. */
  joined: number | null;
  left: number | null;
  previous: { tag: string | null; name: string | null } | null;
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
    .where(and(eq(allianceSnapshots.unionId, unionId), eq(events.isTest, false)))
    .orderBy(asc(events.eventAtUtc));
  const meta = new Map(found.map((r) => [r.eventId, r]));
  const picked = pickReferences(
    found.map((r) => ({ eventId: r.eventId, phase: r.phase, row: toRow(r) })),
  );
  const ordered = [...picked].sort(
    ([a], [b]) =>
      (meta.get(a)?.eventAtUtc.getTime() ?? 0) - (meta.get(b)?.eventAtUtc.getTime() ?? 0),
  );
  const rosters = await membersOf(
    db,
    ordered.map(([, p]) => p.row.id),
  );
  const steps = seriesDeltas(
    ordered.map(([, { row }]) => ({
      isFresh: row.isFresh,
      power: row.totalPower,
      kills: row.totalKills,
      lv: row.level,
      name: row.name,
      tag: row.tag,
      unionId,
    })),
  );
  return ordered.flatMap(([eventId, { reference, row }], i) => {
    const event = meta.get(eventId);
    if (!event) return [];
    const prev = i > 0 ? ordered[i - 1] : undefined;
    const rosterOfRow = (id: number) => rosters.filter((m) => m.allianceSnapshotId === id);
    const diff =
      prev && prev[1].row.isFresh && row.isFresh
        ? rosterDiff(rosterOfRow(prev[1].row.id), rosterOfRow(row.id))
        : null;
    return [
      {
        eventId,
        eventName: event.eventName,
        eventAtUtc: event.eventAtUtc,
        reference,
        tag: row.tag,
        name: row.name,
        memberCount: row.memberCount,
        totalPower: row.totalPower,
        totalKills: row.totalKills,
        level: row.level,
        serverRank: row.serverRank,
        isFresh: row.isFresh,
        step: steps[i] as SeriesStep,
        joined: diff?.joined.length ?? null,
        left: diff?.left.length ?? null,
        previous: prev ? { tag: prev[1].row.tag, name: prev[1].row.name } : null,
      },
    ];
  });
}
