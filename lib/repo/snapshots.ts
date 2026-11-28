// snapshots table. The claim is one conditional statement, never read-then-write.
import { and, eq, inArray, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import { eventWindows, snapshots } from "../schema";
import type { Phase, SnapshotPhase, SnapshotResult, SnapshotRow } from "./index";

// INVARIANT queries.phases-not-samples (D69): the one SQL predicate for "an event's Before or After, not a
// sample". Every reader of the two phases uses it (lib/queries/visibility.ts re-exports it); `isSample` is
// the same test on a row already in memory. Since D160 it is the event's Start (window 1's Before) and End
// (the last window's After): the Befores and Afters between windows are read only by `betweenWindows`.
export const phaseSnapshot = sql`(${snapshots.phase} <> 'sample' and not ${snapshots.betweenWindows})`;

/** The Befores and Afters between an event's windows (D160), read only to sum the windows' changes. */
export const betweenWindows = eq(snapshots.betweenWindows, true);

export function isSample(phase: SnapshotPhase): phase is "sample" {
  return phase === "sample";
}

/** The event window's Before or After row (D160: `window` from 1). */
export async function findSnapshot(
  db: Db,
  eventId: number,
  phase: Phase,
  window = 1,
): Promise<SnapshotRow | null> {
  const [row] = await db
    .select({ id: snapshots.id, status: snapshots.status, startedAt: snapshots.startedAt })
    .from(snapshots)
    .where(
      and(
        eq(snapshots.eventId, eventId),
        eq(snapshots.phase, phase),
        eq(snapshots.windowN, window),
      ),
    );
  return row ?? null;
}

/** A window's Before after window 1, or an After with a later window of its event, lies between two
 * windows (D160). */
const betweenWindowsOf = (eventId: number, phase: Phase, window: number) =>
  phase === "before"
    ? window > 1
    : sql<boolean>`exists (select 1 from ${eventWindows} where ${eventWindows.eventId} = ${eventId} and ${eventWindows.n} > ${window})`;

export async function startSnapshot(
  db: Db,
  eventId: number,
  phase: Phase,
  startedAt: Date,
  expected: SnapshotRow | null,
  window = 1,
): Promise<number | null> {
  // INVARIANT run.single-claim: two callers that read the same row cannot both claim it.
  const rows =
    expected === null
      ? await db
          .insert(snapshots)
          .values({
            eventId,
            phase,
            windowN: window,
            betweenWindows: betweenWindowsOf(eventId, phase, window),
            startedAt,
            status: "running",
          })
          // The partial unique index of a window's Before and After (D69, D160): its predicate selects it.
          .onConflictDoNothing({
            target: [snapshots.eventId, snapshots.windowN, snapshots.phase],
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
  window = 1,
): Promise<number | null> {
  const rows = await db
    .insert(snapshots)
    .values({ eventId, phase: "sample", slotAt, windowN: window, startedAt, status: "running" })
    .onConflictDoNothing({
      target: [snapshots.eventId, snapshots.slotAt],
      where: sql`${snapshots.phase} = 'sample'`,
    })
    .returning({ id: snapshots.id });
  return rows[0]?.id ?? null;
}

/** Another sample of the event window, not `snapshotId`, ended partial or failed: its admin message was the
 * window's one sample message (D69; per window since D160). */
export async function otherShortSample(
  db: Db,
  eventId: number,
  snapshotId: number,
  window = 1,
): Promise<boolean> {
  const [row] = await db
    .select({ id: snapshots.id })
    .from(snapshots)
    .where(
      and(
        eq(snapshots.eventId, eventId),
        eq(snapshots.phase, "sample"),
        eq(snapshots.windowN, window),
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
  /** The event window it belongs to (D160). */
  window: number;
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
            window: r.windowN,
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
