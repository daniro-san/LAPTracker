// alliance_lookups (D133): "Get today's details", one claim row per alliance and server day.
import { and, count, desc, eq, sql } from "drizzle-orm";

import type { Db } from "../db";
import { allianceLookups } from "../schema-alliances";

export type LookupStatus = "running" | "done" | "failed";

export interface Lookup {
  unionId: number;
  day: string;
  claimedAt: Date;
  finishedAt: Date | null;
  status: LookupStatus;
  callsUsed: number;
  quotaRemaining: number | null;
  error: string | null;
}

/**
 * INVARIANT lookups.once-per-alliance-day and lookups.daily-cap: the claim of (alliance, day), under one lock
 * per day, so two presses at the same second make one claim and the day never passes `cap` claims.
 */
export async function claimLookup(
  db: Db,
  unionId: number,
  day: string,
  now: Date,
  cap: number,
): Promise<"claimed" | "taken" | "cap"> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`alliance-lookups:${day}`}))`);
    const [taken] = await tx
      .select({ day: allianceLookups.day })
      .from(allianceLookups)
      .where(and(eq(allianceLookups.unionId, unionId), eq(allianceLookups.day, day)));
    if (taken) return "taken";
    const [used] = await tx
      .select({ n: count() })
      .from(allianceLookups)
      .where(eq(allianceLookups.day, day));
    if ((used?.n ?? 0) >= cap) return "cap";
    await tx.insert(allianceLookups).values({ unionId, day, claimedAt: now, status: "running" });
    return "claimed";
  });
}

export async function finishLookup(
  db: Db,
  unionId: number,
  day: string,
  result: {
    status: Exclude<LookupStatus, "running">;
    finishedAt: Date;
    callsUsed: number;
    quotaRemaining: number | null;
    error: string | null;
  },
): Promise<void> {
  await db
    .update(allianceLookups)
    .set(result)
    .where(and(eq(allianceLookups.unionId, unionId), eq(allianceLookups.day, day)));
}

/** The alliance's claim of `day`, or null. */
export async function lookupOf(db: Db, unionId: number, day: string): Promise<Lookup | null> {
  const [row] = await db
    .select()
    .from(allianceLookups)
    .where(and(eq(allianceLookups.unionId, unionId), eq(allianceLookups.day, day)));
  return row ?? null;
}

/** Every claim of `day`, newest first: /admin's list and the day's count. */
export function lookupsOn(db: Db, day: string): Promise<Lookup[]> {
  return db
    .select()
    .from(allianceLookups)
    .where(eq(allianceLookups.day, day))
    .orderBy(desc(allianceLookups.claimedAt));
}
