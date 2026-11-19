// garrison_plans (D121): an Undead Siege's garrison plan as officers left it, one per entry and week, and
// the claim of its post to Discord. Plain reads and writes inside one workspace; the rules are in
// lib/private/garrison.ts.
import { and, eq, isNull, lt, ne, or, sql } from "drizzle-orm";

import type { Db } from "../db";
import { garrisonPlans, type GarrisonPair } from "../schema";

export type GarrisonRow = typeof garrisonPlans.$inferSelect;

const at = (workspaceId: number, entryId: number, week: string) =>
  and(
    eq(garrisonPlans.workspaceId, workspaceId),
    eq(garrisonPlans.entryId, entryId),
    eq(garrisonPlans.week, week),
  );

export async function findPlan(
  db: Db,
  workspaceId: number,
  entryId: number,
  week: string,
): Promise<GarrisonRow | null> {
  const [row] = await db
    .select()
    .from(garrisonPlans)
    .where(at(workspaceId, entryId, week));
  return row ?? null;
}

/**
 * Writes the pairs when the stored plan is still at `rev` (0: none stored yet). Null when another save
 * came first: the officer's version is stale.
 */
export async function savePlan(
  db: Db,
  plan: { workspaceId: number; entryId: number; week: string },
  rev: number,
  pairs: GarrisonPair[],
  by: number | null,
  now: Date,
): Promise<GarrisonRow | null> {
  if (rev === 0) {
    const [made] = await db
      .insert(garrisonPlans)
      .values({ ...plan, pairs, rev: 1, savedBy: by, savedAt: now })
      .onConflictDoNothing()
      .returning();
    return made ?? null;
  }
  const [row] = await db
    .update(garrisonPlans)
    .set({ pairs, rev: rev + 1, savedBy: by, savedAt: now })
    .where(and(at(plan.workspaceId, plan.entryId, plan.week), eq(garrisonPlans.rev, rev)))
    .returning();
  return row ?? null;
}

/**
 * Claims the plan's post for `requestId` (D100): only when no other request is posting it, or that one
 * started before `stuckBefore`. Null when it is not claimed.
 */
export async function claimPost(
  db: Db,
  id: number,
  requestId: string,
  by: number,
  now: Date,
  stuckBefore: Date,
): Promise<GarrisonRow | null> {
  const [row] = await db
    .update(garrisonPlans)
    .set({ postRequestId: requestId, postStatus: "posting", postedBy: by, postedAt: now })
    .where(
      and(
        eq(garrisonPlans.id, id),
        or(isNull(garrisonPlans.postRequestId), ne(garrisonPlans.postRequestId, requestId)),
        or(
          isNull(garrisonPlans.postStatus),
          ne(garrisonPlans.postStatus, "posting"),
          lt(garrisonPlans.postedAt, stuckBefore),
        ),
      ),
    )
    .returning();
  return row ?? null;
}

export async function finishPost(db: Db, id: number, status: "posted" | "failed"): Promise<void> {
  await db
    .update(garrisonPlans)
    .set({ postStatus: status })
    .where(and(eq(garrisonPlans.id, id), sql`${garrisonPlans.postStatus} = 'posting'`));
}
