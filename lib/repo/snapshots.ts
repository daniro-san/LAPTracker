// snapshots table. The claim is one conditional statement, never read-then-write.
import { and, eq, sql } from "drizzle-orm";

import type { Db } from "../db";
import { snapshots } from "../schema";
import type { Phase, SnapshotResult, SnapshotRow } from "./index";

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
          .onConflictDoNothing({ target: [snapshots.eventId, snapshots.phase] })
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
    r.status === "running" || !r.finishedAt
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
