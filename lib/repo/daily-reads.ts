// daily_reads and daily_rosters (D60): the tick's once-a-day roster read for member history.
import { and, eq, sql } from "drizzle-orm";

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

/** /admin's retry: takes a `failed` day back to `running` for exactly one caller, and clears that
 * day's error rows so the new read can store its own. A failed read has no data rows to lose. */
export async function reclaimFailedDailyRead(
  db: Db,
  day: string,
  startedAt: Date,
): Promise<boolean> {
  const rows = await db
    .update(dailyReads)
    .set({ startedAt, finishedAt: null, status: "running", error: null })
    .where(and(eq(dailyReads.day, day), eq(dailyReads.status, "failed")))
    .returning({ day: dailyReads.day });
  if (rows.length === 0) return false;
  await db.delete(dailyRosters).where(eq(dailyRosters.readDay, day));
  return true;
}

/** Today's read for /admin, or null when none was claimed. */
export async function getDailyRead(db: Db, day: string) {
  const [row] = await db
    .select({
      status: dailyReads.status,
      finishedAt: dailyReads.finishedAt,
      callsUsed: dailyReads.callsUsed,
      error: dailyReads.error,
    })
    .from(dailyReads)
    .where(eq(dailyReads.day, day));
  return row ?? null;
}

export async function insertDailyRoster(db: Db, day: string, row: NewDailyRoster): Promise<void> {
  await db.insert(dailyRosters).values({ ...row, readDay: day });
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
