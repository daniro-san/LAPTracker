// Rehearsals (plan §3.1): is_test events with their own phase times, the REHEARSAL_AT slots that
// create them, their retention, and what the verdict reads back.
import { and, asc, desc, eq, gt, inArray, lte, ne, notExists } from "drizzle-orm";

import type { Db } from "../db";
import {
  allianceSnapshots,
  events,
  memberSnapshots,
  rehearsalSlots,
  runLogs,
  snapshots,
} from "../schema";
import type { NewEvent } from "./events";
import type { Phase, SnapshotStatus } from "./index";

/** True for exactly one caller per slot occurrence. */
export async function claimSlot(db: Db, slotAt: Date): Promise<boolean> {
  const rows = await db
    .insert(rehearsalSlots)
    .values({ slotAt, outcome: "claimed" })
    .onConflictDoNothing()
    .returning({ slotAt: rehearsalSlots.slotAt });
  return rows.length > 0;
}

export async function setSlotOutcome(
  db: Db,
  slotAt: Date,
  outcome: string,
  eventId: number | null,
): Promise<void> {
  await db
    .update(rehearsalSlots)
    .set({ outcome, eventId })
    .where(eq(rehearsalSlots.slotAt, slotAt));
}

/** A rehearsal whose AFTER has not finished and whose AFTER window is still open. */
export async function hasPendingRehearsal(db: Db, now: Date, windowMs: number): Promise<boolean> {
  const finishedAfter = db
    .select({ id: snapshots.id })
    .from(snapshots)
    .where(
      and(
        eq(snapshots.eventId, events.id),
        eq(snapshots.phase, "after"),
        ne(snapshots.status, "running"),
      ),
    );
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.isTest, true),
        gt(events.afterAt, new Date(now.getTime() - windowMs)),
        notExists(finishedAfter),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/** A real (not test) event whose BEFORE falls in (now, now + withinMs]. */
export async function hasRealBeforeWithin(db: Db, now: Date, withinMs: number): Promise<boolean> {
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.isTest, false),
        gt(events.beforeAt, now),
        lte(events.beforeAt, new Date(now.getTime() + withinMs)),
      ),
    )
    .limit(1);
  return row !== undefined;
}

/** A real event's snapshot that is `running` and younger than `staleMs` (the run lock's rule). */
export async function hasRealPhaseRunning(db: Db, now: Date, staleMs: number): Promise<boolean> {
  const [row] = await db
    .select({ id: snapshots.id })
    .from(snapshots)
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(
      and(
        eq(events.isTest, false),
        eq(snapshots.status, "running"),
        gt(snapshots.startedAt, new Date(now.getTime() - staleMs)),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function insertRehearsal(db: Db, event: NewEvent): Promise<number> {
  const [row] = await db
    .insert(events)
    .values({ ...event, allianceIds: [], isTest: true })
    .returning({ id: events.id });
  if (!row) throw new Error("rehearsal insert returned no row");
  return row.id;
}

/** Deletes every rehearsal but the newest `keep`, with their snapshots, rows and logs. */
export async function pruneRehearsals(db: Db, keep: number): Promise<number[]> {
  const old = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.isTest, true))
    .orderBy(desc(events.id))
    .offset(keep);
  const eventIds = old.map((e) => e.id);
  if (eventIds.length === 0) return [];
  await db.transaction(async (tx) => {
    const snapshotIds = tx
      .select({ id: snapshots.id })
      .from(snapshots)
      .where(inArray(snapshots.eventId, eventIds));
    const allianceIds = tx
      .select({ id: allianceSnapshots.id })
      .from(allianceSnapshots)
      .where(inArray(allianceSnapshots.snapshotId, snapshotIds));
    await tx.delete(runLogs).where(inArray(runLogs.snapshotId, snapshotIds));
    await tx
      .delete(memberSnapshots)
      .where(inArray(memberSnapshots.allianceSnapshotId, allianceIds));
    await tx.delete(allianceSnapshots).where(inArray(allianceSnapshots.snapshotId, snapshotIds));
    await tx.delete(snapshots).where(inArray(snapshots.eventId, eventIds));
    // rehearsal_slots.event_id is ON DELETE SET NULL: the slot stays claimed.
    await tx.delete(events).where(inArray(events.id, eventIds));
  });
  return eventIds;
}

export interface VerdictAlliance {
  unionId: number;
  tag: string | null;
  isFresh: boolean;
  sourceUpdatedAt: Date | null;
}

export interface VerdictPhase {
  status: SnapshotStatus;
  scheduledAt: Date;
  startedAt: Date;
  callsUsed: number;
  quotaRemainingBefore: number | null;
  quotaRemainingAfter: number | null;
  durationMs: number | null;
  alliances: VerdictAlliance[];
}

export type VerdictInput = Record<Phase, VerdictPhase | null>;

export async function loadVerdictInput(db: Db, eventId: number): Promise<VerdictInput> {
  const [event] = await db
    .select({ beforeAt: events.beforeAt, afterAt: events.afterAt })
    .from(events)
    .where(eq(events.id, eventId));
  const runs = await db.select().from(snapshots).where(eq(snapshots.eventId, eventId));
  const input: VerdictInput = { before: null, after: null };
  for (const run of runs) {
    const alliances = await db
      .select({
        unionId: allianceSnapshots.unionId,
        tag: allianceSnapshots.tag,
        isFresh: allianceSnapshots.isFresh,
        sourceUpdatedAt: allianceSnapshots.sourceUpdatedAt,
      })
      .from(allianceSnapshots)
      .where(eq(allianceSnapshots.snapshotId, run.id))
      .orderBy(asc(allianceSnapshots.unionId));
    input[run.phase] = {
      status: run.status,
      scheduledAt: (run.phase === "before" ? event?.beforeAt : event?.afterAt) ?? run.startedAt,
      startedAt: run.startedAt,
      callsUsed: run.callsUsed,
      quotaRemainingBefore: run.quotaRemainingBefore,
      quotaRemainingAfter: run.quotaRemainingAfter,
      durationMs: run.durationMs,
      alliances,
    };
  }
  return input;
}
