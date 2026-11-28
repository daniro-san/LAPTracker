// kvk_plans (D161): one KvK calendar entry's plan as officers left it, and the last notice made from it.
// Plain reads and writes inside one workspace; the rules are in lib/private/kvk-plan.ts.
import { and, eq } from "drizzle-orm";

import type { Db } from "../db";
import { kvkPlans, type KvkRole } from "../schema";

export type KvkPlanRow = typeof kvkPlans.$inferSelect;

const at = (workspaceId: number, entryId: number) =>
  and(eq(kvkPlans.workspaceId, workspaceId), eq(kvkPlans.entryId, entryId));

export async function findKvkPlan(
  db: Db,
  workspaceId: number,
  entryId: number,
): Promise<KvkPlanRow | null> {
  const [row] = await db.select().from(kvkPlans).where(at(workspaceId, entryId));
  return row ?? null;
}

/**
 * Writes the roles and the note when the stored plan is still at `rev` (0: not saved yet). Null when another
 * save came first: the officer's version is stale.
 */
export async function writeKvkPlan(
  db: Db,
  key: { workspaceId: number; entryId: number },
  rev: number,
  plan: { roles: KvkRole[]; note: string },
  by: number,
  now: Date,
): Promise<KvkPlanRow | null> {
  const set = { ...plan, rev: rev + 1, savedBy: by, savedAt: now };
  const [row] =
    rev === 0
      ? await db
          .insert(kvkPlans)
          .values({ ...key, ...set })
          .onConflictDoNothing()
          .returning()
      : await db
          .update(kvkPlans)
          .set(set)
          .where(and(at(key.workspaceId, key.entryId), eq(kvkPlans.rev, rev)))
          .returning();
  return row ?? null;
}

/** Remembers the notice "Make the message" made last. */
export async function setPlanNotice(
  db: Db,
  workspaceId: number,
  entryId: number,
  noticeId: number,
): Promise<void> {
  await db.update(kvkPlans).set({ noticeId }).where(at(workspaceId, entryId));
}
