// Read models for GET /api/events and /api/events/[id]. Columns are listed one by one: raw_json and
// member rows are never selected, so no blocked roster key (plan §12.1) can reach a response.
// Test events (rehearsals) are not public (plan Phase 6): /admin reads them elsewhere.
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { Db } from "../db";
import { allianceSnapshots, events, snapshots } from "../schema";
import { publicEvent } from "./visibility";

const snapshotColumns = {
  id: snapshots.id,
  eventId: snapshots.eventId,
  phase: snapshots.phase,
  status: snapshots.status,
  startedAt: snapshots.startedAt,
  finishedAt: snapshots.finishedAt,
};

export async function listEvents(db: Db) {
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      eventAtUtc: events.eventAtUtc,
      isTest: events.isTest,
      manual: events.manual,
    })
    .from(events)
    .where(publicEvent)
    .orderBy(desc(events.eventAtUtc));
  const phases = rows.length
    ? await db
        .select(snapshotColumns)
        .from(snapshots)
        .where(
          inArray(
            snapshots.eventId,
            rows.map((e) => e.id),
          ),
        )
    : [];
  return rows.map((e) => ({
    ...e,
    snapshots: phases.filter((s) => s.eventId === e.id).map(({ eventId: _, ...s }) => s),
  }));
}

export type EventSummary = Awaited<ReturnType<typeof listEvents>>[number];

/**
 * The event `/` shows, from `listEvents` (newest first; D28): the newest real event with a complete
 * Before, else the newest event of any kind with one, else the newest real event, else the newest.
 * An upcoming event the tick created a day ahead has no Before yet, so it does not take the home page.
 */
export function homeEvent<
  E extends {
    manual: boolean;
    snapshots: Pick<EventSummary["snapshots"][number], "phase" | "status">[];
  },
>(events: E[]): E | undefined {
  const hasData = (e: E) =>
    e.snapshots.some((s) => s.phase === "before" && s.status === "complete");
  return (
    events.find((e) => !e.manual && hasData(e)) ??
    events.find(hasData) ??
    events.find((e) => !e.manual) ??
    events[0]
  );
}

/** Served alliance fields: §12.1's list plus the row's source and whether it failed. */
async function allianceRows(db: Db, snapshotIds: number[]) {
  if (snapshotIds.length === 0) return [];
  const rows = await db
    .select({
      snapshotId: allianceSnapshots.snapshotId,
      unionId: allianceSnapshots.unionId,
      tag: allianceSnapshots.tag,
      name: allianceSnapshots.name,
      badgeId: allianceSnapshots.badgeId,
      memberCount: allianceSnapshots.memberCount,
      totalPower: allianceSnapshots.totalPower,
      totalKills: allianceSnapshots.totalKills,
      powerBoard: allianceSnapshots.powerBoard,
      killsBoard: allianceSnapshots.killsBoard,
      serverRank: allianceSnapshots.serverRank,
      source: allianceSnapshots.source,
      sourceUpdatedAt: allianceSnapshots.sourceUpdatedAt,
      cached: allianceSnapshots.cached,
      isFresh: allianceSnapshots.isFresh,
      error: allianceSnapshots.error,
    })
    .from(allianceSnapshots)
    .where(inArray(allianceSnapshots.snapshotId, snapshotIds))
    .orderBy(asc(allianceSnapshots.unionId));
  return rows.map(({ error, ...row }) => ({ ...row, failed: error !== null }));
}

export async function getEventDetail(db: Db, eventId: number) {
  const [event] = await db
    .select({
      id: events.id,
      name: events.name,
      eventAtUtc: events.eventAtUtc,
      beforeAt: events.beforeAt,
      afterAt: events.afterAt,
      isTest: events.isTest,
      manual: events.manual,
    })
    .from(events)
    .where(and(eq(events.id, eventId), publicEvent));
  if (!event) return null;
  const phases = await db
    .select({
      ...snapshotColumns,
      callsUsed: snapshots.callsUsed,
      quotaRemainingAfter: snapshots.quotaRemainingAfter,
      boardPulledAt: snapshots.boardPulledAt,
      durationMs: snapshots.durationMs,
      // One line: codes and counts only (plan §6); the chips show it.
      error: snapshots.error,
    })
    .from(snapshots)
    .where(eq(snapshots.eventId, eventId));
  const rows = await allianceRows(
    db,
    phases.map((s) => s.id),
  );
  return {
    ...event,
    snapshots: phases.map(({ eventId: _, ...s }) => ({
      ...s,
      alliances: rows.filter((r) => r.snapshotId === s.id).map(({ snapshotId: _, ...r }) => r),
    })),
  };
}
