// snapshots table. The claim is one conditional statement, never read-then-write.
import { and, eq, inArray, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import { snapshots } from "../schema";
import type { Phase, SnapshotPhase, SnapshotResult, SnapshotRow } from "./index";

// INVARIANT queries.phases-not-samples (D69): the one SQL predicate for "an event's Before or After, not a
// sample". Every reader of the two phases uses it (lib/queries/visibility.ts re-exports it); `isSample` is
// the same test on a row already in memory.
export const phaseSnapshot = ne(snapshots.phase, "sample");

export function isSample(phase: SnapshotPhase): phase is "sample" {
  return phase === "sample";
}

export async function findSnapshot(
  db: Db,
  eventId: number,
  phase: Phase,
): Promise<SnapshotRow | null> {
  const [row] = await db
    .select({ id: snapshots.id, status: snapshots.status, startedAt: snapshots.startedAt })
    .from(snapshots)
    .where(and(eq(snapshots.eventId, eventId), eq(snapshots.phase, phase)));
  return row ?? null;
}

export async function startSnapshot(
  db: Db,
  eventId: number,
  phase: Phase,
  startedAt: Date,
  expected: SnapshotRow | null,
): Promise<number | null> {
  // INVARIANT run.single-claim: two callers that read the same row cannot both claim it.
  const rows =
    expected === null
      ? await db
          .insert(snapshots)
          .values({ eventId, phase, startedAt, status: "running" })
          // The partial unique index of Before and After (D69): its predicate selects it.
          .onConflictDoNothing({
            target: [snapshots.eventId, snapshots.phase],
            where: sql`${snapshots.phase} <> 'sample'`,
          })
          .returning({ id: snapshots.id })
      : await db
          .update(snapshots)
          .set({ status: "running", startedAt, finishedAt: null, error: null, durationMs: null })
          .where(
            and(
              eq(snapshots.id, expected.id),
              eq(snapshots.status, expected.status),
              eq(snapshots.startedAt, expected.startedAt),
            ),
          )
          .returning({ id: snapshots.id });
  return rows[0]?.id ?? null;
}

/** INVARIANT sample.once-per-slot (D69): the insert is the claim, so two ticks in one slot cannot both
 * take it, and a taken slot is never taken again (no re-run, no catch-up). */
export async function startSample(
  db: Db,
  eventId: number,
  slotAt: Date,
  startedAt: Date,
): Promise<number | null> {
  const rows = await db
    .insert(snapshots)
    .values({ eventId, phase: "sample", slotAt, startedAt, status: "running" })
    .onConflictDoNothing({
      target: [snapshots.eventId, snapshots.slotAt],
      where: sql`${snapshots.phase} = 'sample'`,
    })
    .returning({ id: snapshots.id });
  return rows[0]?.id ?? null;
}

/** Another sample of the event, not `snapshotId`, ended partial or failed: its admin message was the
 * event's one sample message (D69). */
export async function otherShortSample(
  db: Db,
  eventId: number,
  snapshotId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: snapshots.id })
    .from(snapshots)
    .where(
      and(
        eq(snapshots.eventId, eventId),
        eq(snapshots.phase, "sample"),
        ne(snapshots.id, snapshotId),
        inArray(snapshots.status, ["partial", "failed"]),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export async function finishSnapshot(
  db: Db,
  snapshotId: number,
  result: SnapshotResult,
): Promise<void> {
  await db
    .update(snapshots)
    .set({
      status: result.status,
      finishedAt: result.finishedAt,
      callsUsed: sql`${snapshots.callsUsed} + ${result.callsUsed}`,
      quotaRemainingBefore: result.quotaRemainingBefore,
      quotaRemainingAfter: result.quotaRemainingAfter,
      quotaUnseenCalls: result.quotaUnseenCalls,
      boardPulledAt: result.boardPulledAt,
      error: result.error,
      durationMs: result.durationMs,
    })
    .where(eq(snapshots.id, snapshotId));
}

/** A finished run of one phase, for the event's one Discord message (D31). */
export interface PhaseReport {
  phase: Phase;
  snapshotId: number;
  status: "complete" | "partial" | "failed";
  startedAt: Date;
  finishedAt: Date;
  callsUsed: number;
  quotaRemainingAfter: number | null;
  durationMs: number;
  error: string | null;
}

export async function listPhaseReports(db: Db, eventId: number): Promise<PhaseReport[]> {
  const rows = await db.select().from(snapshots).where(eq(snapshots.eventId, eventId));
  return rows.flatMap((r) =>
    // A sample is not a phase: the event's message keeps its Before and After blocks only (D69).
    isSample(r.phase) || r.status === "running" || !r.finishedAt
      ? []
      : [
          {
            phase: r.phase,
            snapshotId: r.id,
            status: r.status,
            startedAt: r.startedAt,
            finishedAt: r.finishedAt,
            callsUsed: r.callsUsed,
            quotaRemainingAfter: r.quotaRemainingAfter,
            durationMs: r.durationMs ?? 0,
            error: r.error,
          },
        ],
  );
}
