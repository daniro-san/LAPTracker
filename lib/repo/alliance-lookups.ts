// alliance_lookups (D133): "Get today's details", one claim row per alliance and server day.
import { and, desc, eq, sql } from "drizzle-orm";

import type { Db } from "../db";
import { allianceLookups } from "../schema-alliances";

export type LookupStatus = "running" | "done" | "refused" | "failed";

/** A claim still "running" this long after it was made belongs to a killed function: it reads as failed. */
export const LOOKUP_STALE_AFTER_MS = 5 * 60_000;

/** The status a claim shows at `now`: a stale "running" one is "failed" (its function was killed). */
export const shownStatus = (l: Pick<Lookup, "status" | "claimedAt">, now: Date): LookupStatus =>
  l.status === "running" && now.getTime() - l.claimedAt.getTime() > LOOKUP_STALE_AFTER_MS
    ? "failed"
    : l.status;

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
 * The quota call, made inside the claim's lock: whether one more read keeps the reserve, with what it said.
 * `error`: the call itself failed (no quota known), which keeps the claim as "failed".
 */
export type QuotaGate = (
  inFlight: number,
) => Promise<{ ok: boolean; remaining: number | null; error?: string }>;

/**
 * INVARIANT lookups.once-per-alliance-day, lookups.daily-cap and lookups.keeps-event-reserve: the claim of
 * (alliance, day), under one lock per day. Two presses at the same second make one claim, the day never
 * passes `cap` claims, and the quota gate runs inside the lock with the reads still in flight counted, so
 * parallel lookups cannot together go below the reserve. A refusal by the gate keeps the claim, "refused".
 */
export async function claimLookup(
  db: Db,
  key: { unionId: number; day: string },
  now: Date,
  cap: number,
  gate: QuotaGate,
): Promise<{ code: "claimed" | "taken" | "cap" | "refused" | "failed"; remaining: number | null }> {
  const { unionId, day } = key;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`alliance-lookups:${day}`}))`);
    const claims = await tx
      .select({
        unionId: allianceLookups.unionId,
        status: allianceLookups.status,
        claimedAt: allianceLookups.claimedAt,
      })
      .from(allianceLookups)
      .where(eq(allianceLookups.day, day));
    if (claims.some((c) => c.unionId === unionId)) return { code: "taken", remaining: null };
    if (claims.length >= cap) return { code: "cap", remaining: null };
    const inFlight = claims.filter((c) => shownStatus(c, now) === "running").length;
    const { ok, remaining, error } = await gate(inFlight);
    const row = { unionId, day, claimedAt: now, callsUsed: 1, quotaRemaining: remaining };
    if (!ok) {
      const status = error ? "failed" : "refused";
      await tx
        .insert(allianceLookups)
        .values({ ...row, status, finishedAt: now, error: error ?? "quota" });
      return { code: status, remaining };
    }
    await tx.insert(allianceLookups).values({ ...row, status: "running" });
    return { code: "claimed", remaining };
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
