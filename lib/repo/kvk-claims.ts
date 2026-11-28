// kvk_claims (issue 831, D161 amended): the members' "I'm in" for a KvK plan's roles, not yet answered.
// Plain reads and writes inside one workspace; the rules are in lib/private/kvk-claims.ts.
import { and, eq } from "drizzle-orm";

import type { Db } from "../db";
import { kvkClaims } from "../schema";

export type KvkClaimRow = typeof kvkClaims.$inferSelect;

type Key = { workspaceId: number; entryId: number; role: string; uid: number };

const at = (k: Key) =>
  and(
    eq(kvkClaims.workspaceId, k.workspaceId),
    eq(kvkClaims.entryId, k.entryId),
    eq(kvkClaims.role, k.role),
    eq(kvkClaims.uid, k.uid),
  );

/** The entry's open asks, oldest first. */
export async function claimsOf(
  db: Db,
  workspaceId: number,
  entryId: number,
): Promise<KvkClaimRow[]> {
  return db
    .select()
    .from(kvkClaims)
    .where(and(eq(kvkClaims.workspaceId, workspaceId), eq(kvkClaims.entryId, entryId)))
    .orderBy(kvkClaims.askedAt);
}

/** Adds the ask; asking twice keeps the first. */
export async function addClaim(db: Db, key: Key, now: Date): Promise<void> {
  await db
    .insert(kvkClaims)
    .values({ ...key, askedAt: now })
    .onConflictDoNothing();
}

/** Deletes the ask; true when there was one. */
export async function removeClaim(db: Db, key: Key): Promise<boolean> {
  return (await db.delete(kvkClaims).where(at(key)).returning()).length > 0;
}
