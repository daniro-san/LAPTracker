// daily_reads and daily_rosters (D60): the tick's once-a-day roster read for member history.
import { eq } from "drizzle-orm";

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
  await db.update(dailyReads).set(result).where(eq(dailyReads.day, day));
}
