// Read models for GET /api/events and /api/events/[id]. Columns are listed one by one: raw_json and
// member rows are never selected, so no blocked roster key (plan §12.1) can reach a response.
// Test events (rehearsals) are not public (plan Phase 6): /admin reads them elsewhere.
import { and, asc, desc, eq, inArray, isNull, lt } from "drizzle-orm";

import { runAbandoned } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, events, snapshots } from "../schema";
import { chainEvent, phaseColumn, phaseSnapshot, publicEvent } from "./visibility";

const snapshotColumns = {
  id: snapshots.id,
  eventId: snapshots.eventId,
  phase: phaseColumn,
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
      afterAt: events.afterAt,
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
          and(
            inArray(
              snapshots.eventId,
              rows.map((e) => e.id),
            ),
            phaseSnapshot,
          ),
        )
    : [];
  return rows.map((e) => ({
    ...e,
    snapshots: phases.filter((s) => s.eventId === e.id).map(({ eventId: _, ...s }) => s),
  }));
}

export type EventSummary = Awaited<ReturnType<typeof listEvents>>[number];

/** How often the tick runs (.github/workflows/tick.yml: every 15 minutes). */
const TICK_EVERY_MS = 15 * 60_000;

/**
 * The event `/` shows, from `listEvents` (newest first; D28): the newest real event with a complete
 * snapshot whose End is done or still to come, else the newest event of any kind like that, else the
 * newest real event with a complete snapshot, else the newest event with one, else the newest real event,
 * else the newest. An upcoming event the tick created a day ahead has no data yet, so it does not take the
 * home page. An event whose End never came has no result, so the last finished one keeps the home page
 * (panel PD-3): its End failed or was left running past RUN_STALE_AFTER_MS, or no End row exists once the
 * tick's window for it (`windowMin`, SNAPSHOT_WINDOW_MIN, as `duePhases`) and one more tick have passed.
 */
export function homeEvent<
  E extends {
    manual: boolean;
    afterAt: Date;
    snapshots: Pick<EventSummary["snapshots"][number], "phase" | "status" | "startedAt">[];
  },
>(events: E[], now: Date, windowMin: number): E | undefined {
  const hasData = (e: E) => e.snapshots.some((s) => s.status === "complete");
  const endWaitMs = windowMin * 60_000 + TICK_EVERY_MS;
  const answered = (e: E) => {
    const end = e.snapshots.find((s) => s.phase === "after");
    if (!end) return now.getTime() < e.afterAt.getTime() + endWaitMs;
    if (end.status === "running") return !runAbandoned(end, now);
    return end.status === "complete" || end.status === "partial";
  };
  return (
    events.find((e) => !e.manual && hasData(e) && answered(e)) ??
    events.find((e) => hasData(e) && answered(e)) ??
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
    .where(and(eq(snapshots.eventId, eventId), phaseSnapshot));
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

/** One alliance's figures at an event's reference reading (the End, else the Start). */
export interface EventTotals {
  power: number | null;
  kills: number | null;
  members: number | null;
}

/**
 * The previous event before `event` that takes part in "since the previous event" (`chainEvent`, D28): its
 * day and each alliance's figures at its reference reading, the End when that was read fresh, else the
 * Start (Phase 5e). Only fresh rows with no error (INVARIANT freshness.no-stale-delta). Null for a manual
 * round, or when no earlier event has a reading (issue 473: the ledger's "since" line).
 */
export async function previousEventTotals(
  db: Db,
  event: { id: number; eventAtUtc: Date; manual: boolean },
): Promise<{ at: Date; rows: [number, EventTotals][] } | null> {
  if (event.manual) return null;
  const [previous] = await db
    .selectDistinct({ id: events.id, eventAtUtc: events.eventAtUtc })
    .from(events)
    .innerJoin(snapshots, eq(snapshots.eventId, events.id))
    .where(and(chainEvent, lt(events.eventAtUtc, event.eventAtUtc), phaseSnapshot))
    .orderBy(desc(events.eventAtUtc))
    .limit(1);
  if (!previous) return null;
  const rows = await db
    .select({
      unionId: allianceSnapshots.unionId,
      phase: phaseColumn,
      power: allianceSnapshots.totalPower,
      kills: allianceSnapshots.totalKills,
      members: allianceSnapshots.memberCount,
    })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .where(
      and(
        eq(snapshots.eventId, previous.id),
        phaseSnapshot,
        eq(allianceSnapshots.isFresh, true),
        isNull(allianceSnapshots.error),
      ),
    );
  const picked = new Map<number, EventTotals & { phase: string }>();
  for (const r of rows) if (!picked.has(r.unionId) || r.phase === "after") picked.set(r.unionId, r);
  return {
    at: previous.eventAtUtc,
    rows: [...picked].map(([id, { power, kills, members }]) => [id, { power, kills, members }]),
  };
}
