// The read model for the event charts that follow (D69): an event's usable readings in time order, its
// Before (Start), its samples, its After (End), each alliance with its totals and its members' might and
// kills. Not used by a page yet. Served member fields: uid, might, kills only (names come from Start/End).
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import type { SnapshotPhase } from "../repo";
import { isSample } from "../repo/snapshots";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import { publicEvent } from "./visibility";

export interface SampleMember {
  uid: number;
  might: number | null;
  kills: number | null;
}

export interface SampleAlliance {
  unionId: number;
  /** The upstream time of the read. */
  readAt: Date | null;
  /** False: older than 20 minutes when read; a stale sample shows no change (glossary). */
  isFresh: boolean;
  might: number | null;
  kills: number | null;
  members: number | null;
  roster: SampleMember[];
}

export interface EventReading {
  kind: SnapshotPhase;
  /** A sample's slot; the event's before_at or after_at for its Start or End. */
  at: Date;
  alliances: SampleAlliance[];
}

const ORDER: Record<SnapshotPhase, number> = { before: 0, sample: 1, after: 2 };

const numbers = (values: (string | null)[] | null) =>
  (values ?? []).map((v) => (v === null ? null : Number(v)));

/** The alliance rows of these snapshots that were read (no error), with a sample's member arrays. */
function usableRows(db: Db, snapshotIds: number[]) {
  return db
    .select({
      id: allianceSnapshots.id,
      snapshotId: allianceSnapshots.snapshotId,
      unionId: allianceSnapshots.unionId,
      readAt: allianceSnapshots.sourceUpdatedAt,
      isFresh: allianceSnapshots.isFresh,
      might: allianceSnapshots.totalPower,
      kills: allianceSnapshots.totalKills,
      members: allianceSnapshots.memberCount,
      uids: allianceSnapshots.memberUids,
      // As text: Drizzle reads a null bigint element as 0, and a null stays null (D15).
      power: sql<(string | null)[] | null>`${allianceSnapshots.memberPower}::text[]`,
      killList: sql<(string | null)[] | null>`${allianceSnapshots.memberKills}::text[]`,
    })
    .from(allianceSnapshots)
    .where(
      and(inArray(allianceSnapshots.snapshotId, snapshotIds), isNull(allianceSnapshots.error)),
    );
}

type UsableRow = Awaited<ReturnType<typeof usableRows>>[number];

/** The member rows of a Start's or End's alliance rows: uid, might, kills. */
async function phaseMembers(db: Db, allianceSnapshotIds: number[]) {
  if (allianceSnapshotIds.length === 0) return [];
  return db
    .select({
      id: memberSnapshots.allianceSnapshotId,
      uid: memberSnapshots.uid,
      might: memberSnapshots.power,
      kills: memberSnapshots.kills,
    })
    .from(memberSnapshots)
    .where(inArray(memberSnapshots.allianceSnapshotId, allianceSnapshotIds));
}

/**
 * The public event's readings, Start, samples by slot, End; a reading still running or with no usable
 * alliance (every row failed) is left out, and so is a failed alliance row. Null when the event is not
 * public (`publicEvent`).
 */
export async function eventSamples(db: Db, eventId: number): Promise<EventReading[] | null> {
  const [event] = await db
    .select({ beforeAt: events.beforeAt, afterAt: events.afterAt })
    .from(events)
    .where(and(eq(events.id, eventId), publicEvent));
  if (!event) return null;
  const snaps = await db
    .select({ id: snapshots.id, phase: snapshots.phase, slotAt: snapshots.slotAt })
    .from(snapshots)
    .where(and(eq(snapshots.eventId, eventId), ne(snapshots.status, "running")));
  if (snaps.length === 0) return [];
  const rows = await usableRows(
    db,
    snaps.map((s) => s.id),
  );
  // Start and End keep their members as rows; a sample's are the arrays on its alliance row.
  const phaseIds = new Set(snaps.filter((s) => !isSample(s.phase)).map((s) => s.id));
  const memberRows = await phaseMembers(
    db,
    rows.filter((r) => phaseIds.has(r.snapshotId)).map((r) => r.id),
  );
  const rosterOf = (r: UsableRow): SampleMember[] => {
    if (phaseIds.has(r.snapshotId))
      return memberRows.filter((m) => m.id === r.id).map(({ id: _, ...m }) => m);
    const [might, kills] = [numbers(r.power), numbers(r.killList)];
    return (r.uids ?? []).map((uid, i) => ({
      uid,
      might: might[i] ?? null,
      kills: kills[i] ?? null,
    }));
  };
  const atOf = (s: (typeof snaps)[number]) =>
    s.phase === "before"
      ? event.beforeAt
      : s.phase === "after"
        ? event.afterAt
        : (s.slotAt as Date);
  return snaps
    .map((s) => ({
      kind: s.phase,
      at: atOf(s),
      alliances: rows
        .filter((r) => r.snapshotId === s.id)
        .sort((a, b) => a.unionId - b.unionId)
        .map((r) => ({
          unionId: r.unionId,
          readAt: r.readAt,
          isFresh: r.isFresh,
          might: r.might,
          kills: r.kills,
          members: r.members,
          roster: rosterOf(r),
        })),
    }))
    .filter((reading) => reading.alliances.length > 0)
    .sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.at.getTime() - b.at.getTime());
}
