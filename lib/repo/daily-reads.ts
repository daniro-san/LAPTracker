// daily_reads and daily_rosters (D60): the tick's once-a-day roster read for member history.
import { and, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";

import type { Db } from "../db";
import { dailyReads, dailyRosters } from "../schema";

export type DailyReadStatus = "complete" | "partial" | "failed";
export type NewDailyRoster = Omit<typeof dailyRosters.$inferInsert, "id" | "readDay">;

/** True for exactly one caller per server day. */
export async function claimDailyRead(db: Db, day: string, startedAt: Date): Promise<boolean> {
  const rows = await db
    .insert(dailyReads)
    .values({ day, startedAt, status: "running" })
    .onConflictDoNothing()
    .returning({ day: dailyReads.day });
  return rows.length > 0;
}

/** /admin's retry (D67): takes a day that fell short (`failed` or `partial`), or one left `running`
 * since before `staleBefore` (the read was killed), back to `running` for exactly one caller. Then it
 * drops that day's error rows, so the new read can store its own. The rosters already read stay. */
export async function reclaimDailyRead(
  db: Db,
  day: string,
  startedAt: Date,
  staleBefore: Date,
): Promise<boolean> {
  const rows = await db
    .update(dailyReads)
    .set({ startedAt, finishedAt: null, status: "running", error: null })
    .where(
      and(
        eq(dailyReads.day, day),
        or(
          inArray(dailyReads.status, ["failed", "partial"]),
          and(eq(dailyReads.status, "running"), lt(dailyReads.startedAt, staleBefore)),
        ),
      ),
    )
    .returning({ day: dailyReads.day });
  if (rows.length === 0) return false;
  await db
    .delete(dailyRosters)
    .where(and(eq(dailyRosters.readDay, day), isNotNull(dailyRosters.error)));
  return true;
}

/** Today's read for /admin, or null when none was claimed. */
export async function getDailyRead(db: Db, day: string) {
  const [row] = await db
    .select({
      status: dailyReads.status,
      startedAt: dailyReads.startedAt,
      finishedAt: dailyReads.finishedAt,
      callsUsed: dailyReads.callsUsed,
      error: dailyReads.error,
    })
    .from(dailyReads)
    .where(eq(dailyReads.day, day));
  return row ?? null;
}

/**
 * Stores one alliance's row of the day. On a retry a roster that was read replaces the day's earlier
 * one. INVARIANT daily-read.retry-keeps-rosters: an error row never replaces a roster the day has.
 */
export async function storeDailyRoster(db: Db, day: string, row: NewDailyRoster): Promise<void> {
  const insert = db.insert(dailyRosters).values({ ...row, readDay: day });
  if (typeof row.error === "string") await insert.onConflictDoNothing();
  else
    await insert.onConflictDoUpdate({
      target: [dailyRosters.readDay, dailyRosters.unionId],
      set: row,
    });
}

/** Every row the day has now, for the read's outcome: after a retry that includes the rosters it kept. */
export function dailyRosterStates(db: Db, day: string) {
  return db
    .select({
      unionId: dailyRosters.unionId,
      tag: dailyRosters.tag,
      isFresh: dailyRosters.isFresh,
      error: dailyRosters.error,
      sourceUpdatedAt: dailyRosters.sourceUpdatedAt,
    })
    .from(dailyRosters)
    .where(eq(dailyRosters.readDay, day));
}

export async function finishDailyRead(
  db: Db,
  day: string,
  result: {
    status: DailyReadStatus;
    finishedAt: Date;
    callsUsed: number;
    quotaRemainingBefore: number | null;
    error: string | null;
  },
): Promise<void> {
  // A retry adds its calls to the failed attempt's: calls_used stays the day's total.
  await db
    .update(dailyReads)
    .set({ ...result, callsUsed: sql`${dailyReads.callsUsed} + ${result.callsUsed}` })
    .where(eq(dailyReads.day, day));
}
