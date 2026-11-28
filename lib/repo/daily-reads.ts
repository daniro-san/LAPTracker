// daily_reads and daily_rosters (D60): the tick's once-a-day roster read for member history.
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type { Db } from "../db";
import { dailyReads, dailyRosters } from "../schema";
import { lookedUpThatDay } from "./alliance-lookups";

export type DailyReadStatus = "complete" | "partial" | "failed";
export type NewDailyRoster = Omit<typeof dailyRosters.$inferInsert, "id" | "readDay">;

/** True for exactly one caller per server day. Each claim stores its attempt's `targetIds` (issue 625). */
export async function claimDailyRead(
  db: Db,
  day: string,
  startedAt: Date,
  targetIds: number[],
): Promise<boolean> {
  const rows = await db
    .insert(dailyReads)
    .values({ day, startedAt, status: "running", targetIds })
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
  targetIds: number[],
): Promise<boolean> {
  const rows = await db
    .update(dailyReads)
    .set({ startedAt, finishedAt: null, status: "running", error: null, targetIds })
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
  await dropErrorRows(db, day);
  return true;
}

/** The tick's automatic retry (D72): takes a day that fell short (`failed` or `partial`) back to
 * `running` for exactly one caller, once per day, and only when its read started before
 * `startedBefore` (a later tick, not a second caller of the same tick). Then it drops the day's error
 * rows, as the admin's retry does. */
export async function claimAutoRetry(
  db: Db,
  day: string,
  startedAt: Date,
  startedBefore: Date,
  targetIds: number[],
): Promise<boolean> {
  const rows = await db
    .update(dailyReads)
    .set({
      startedAt,
      finishedAt: null,
      status: "running",
      error: null,
      autoRetryAt: startedAt,
      targetIds,
    })
    .where(
      and(
        eq(dailyReads.day, day),
        inArray(dailyReads.status, ["failed", "partial"]),
        isNull(dailyReads.autoRetryAt),
        lt(dailyReads.startedAt, startedBefore),
      ),
    )
    .returning({ day: dailyReads.day });
  if (rows.length === 0) return false;
  await dropErrorRows(db, day);
  return true;
}

const dropErrorRows = (db: Db, day: string) =>
  db.delete(dailyRosters).where(and(eq(dailyRosters.readDay, day), isNotNull(dailyRosters.error)));

/** Today's read for /admin, or null when none was claimed. */
export async function getDailyRead(db: Db, day: string) {
  const [row] = await db
    .select({
      status: dailyReads.status,
      startedAt: dailyReads.startedAt,
      finishedAt: dailyReads.finishedAt,
      callsUsed: dailyReads.callsUsed,
      error: dailyReads.error,
      // The squads read starts from what the day's read left (D117).
      quotaRemainingBefore: dailyReads.quotaRemainingBefore,
    })
    .from(dailyReads)
    .where(eq(dailyReads.day, day));
  return row ?? null;
}

/**
 * Stores one alliance's row of the day. On a retry a roster that was read replaces the day's earlier
 * one. INVARIANT daily-read.retry-keeps-rosters: an error row never replaces a roster the day has.
 */
export async function storeDailyRoster(
  db: Db,
  day: string,
  row: NewDailyRoster,
  storedAt: Date,
): Promise<void> {
  const insert = db.insert(dailyRosters).values({ ...row, readDay: day, storedAt });
  if (typeof row.error === "string") await insert.onConflictDoNothing();
  else
    await insert.onConflictDoUpdate({
      target: [dailyRosters.readDay, dailyRosters.unionId],
      set: { ...row, storedAt },
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

/** The alliances whose roster of the day is still the "Get today's details" one (D133): looked up that day
 * and stored before `before`, the start of the day's read, so no read of the day replaced it (issue 625). */
export async function lookupRostersBefore(db: Db, day: string, before: Date): Promise<number[]> {
  const rows = await db
    .select({ unionId: dailyRosters.unionId })
    .from(dailyRosters)
    .where(
      and(
        eq(dailyRosters.readDay, day),
        isNull(dailyRosters.error),
        lt(dailyRosters.storedAt, before),
        lookedUpThatDay(db),
      ),
    );
  return rows.map((r) => r.unionId);
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

/** Each id's members in its newest daily roster that was read; an id with none is left out. The collector's
 * identity check compares a read under a new tag with it (D69 amendment, 2026-11-21). */
export async function lastMemberUids(
  db: Db,
  ids: readonly number[],
): Promise<Map<number, number[]>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .selectDistinctOn([dailyRosters.unionId], {
      unionId: dailyRosters.unionId,
      uids: dailyRosters.memberUids,
    })
    .from(dailyRosters)
    .where(and(inArray(dailyRosters.unionId, [...ids]), isNull(dailyRosters.error)))
    .orderBy(dailyRosters.unionId, desc(dailyRosters.readDay));
  return new Map(rows.map((r) => [r.unionId, r.uids]));
}

/**
 * The alliance's members (uids and their public names) in the day's roster, only when that roster was read
 * and is fresh; null for an error row, a stale roster or none. The welcome post (D159, post 3) compares two
 * days with it, so a failed or stale read never makes anyone new.
 */
export async function freshRosterOfDay(
  db: Db,
  day: string,
  unionId: number,
): Promise<{ uids: number[]; names: string[] } | null> {
  const [row] = await db
    .select({ uids: dailyRosters.memberUids, names: dailyRosters.memberNames })
    .from(dailyRosters)
    .where(
      and(
        eq(dailyRosters.readDay, day),
        eq(dailyRosters.unionId, unionId),
        isNull(dailyRosters.error),
        eq(dailyRosters.isFresh, true),
      ),
    );
  return row ?? null;
}

/**
 * The alliance's usable rosters (fresh, no error, not empty) from `from` to `to`, server days, oldest first:
 * each day's member uids and nothing else. The weekly members summary (D159, post 4) counts with it.
 */
export async function freshUidsBetween(
  db: Db,
  unionId: number,
  from: string,
  to: string,
): Promise<{ day: string; uids: number[] }[]> {
  return db
    .select({ day: dailyRosters.readDay, uids: dailyRosters.memberUids })
    .from(dailyRosters)
    .where(
      and(
        eq(dailyRosters.unionId, unionId),
        gte(dailyRosters.readDay, from),
        lte(dailyRosters.readDay, to),
        isNull(dailyRosters.error),
        eq(dailyRosters.isFresh, true),
        gt(dailyRosters.memberCount, 0),
      ),
    )
    .orderBy(asc(dailyRosters.readDay));
}
