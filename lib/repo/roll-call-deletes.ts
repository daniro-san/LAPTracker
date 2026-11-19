// A roll call's delete, its Undo, and its archive (issue 424, D120): a soft delete on the roll_calls row,
// with who, when and the request id (D100), and who archived it and when. The row and its marks stay; every
// other read leaves a deleted roll call out (`live` in ./roll-call).
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";

import type { Db } from "../db";
import { rollCalls } from "../schema";
import { live } from "./roll-call";

export interface CallChange {
  workspaceId: number;
  id: number;
  userId: number;
  now: Date;
}

const mine = (c: CallChange) =>
  and(eq(rollCalls.workspaceId, c.workspaceId), eq(rollCalls.id, c.id));

/**
 * Deletes a live roll call (D120). A retry under the same request id finds its own delete and is true
 * without writing, also after that delete was undone (a late replay must not delete again); false when the
 * workspace has no such live roll call.
 */
export async function markCallDeleted(
  db: Db,
  c: CallChange & { requestId: string },
): Promise<boolean> {
  const [done] = await db
    .update(rollCalls)
    .set({ deletedAt: c.now, deletedBy: c.userId, deleteRequestId: c.requestId })
    .where(and(mine(c), live, sql`${rollCalls.deleteRequestId} is distinct from ${c.requestId}`))
    .returning({ id: rollCalls.id });
  if (done) return true;
  const [again] = await db
    .select({ id: rollCalls.id })
    .from(rollCalls)
    .where(and(mine(c), eq(rollCalls.deleteRequestId, c.requestId)));
  return again !== undefined;
}

/**
 * Undoes the officer's own delete made under `requestId` since `since` (D120). A repeat of an Undo that
 * worked is true again. False otherwise: someone else's, too late, or a new roll call took its place
 * meanwhile (the same Calendar week, or the same kind and day added by hand).
 */
export async function unmarkCallDeleted(
  db: Db,
  c: CallChange & { requestId: string },
  since: Date,
): Promise<boolean> {
  const [done] = await db
    .update(rollCalls)
    .set({ deletedAt: null })
    .where(
      and(
        mine(c),
        eq(rollCalls.deleteRequestId, c.requestId),
        eq(rollCalls.deletedBy, c.userId),
        or(live, gt(rollCalls.deletedAt, since)),
        sql`not exists (select 1 from roll_calls o
          where o.deleted_at is null and o.id <> ${rollCalls.id}
            and ((o.entry_id = ${rollCalls.entryId} and o.week = ${rollCalls.week})
              or (${rollCalls.requestId} is not null and o.request_id is not null
                and o.workspace_id = ${rollCalls.workspaceId} and o.kind = ${rollCalls.kind}
                and o.day = ${rollCalls.day})))`,
      ),
    )
    .returning({ id: rollCalls.id });
  return done !== undefined;
}

/**
 * Archives (`on`) or unarchives a live roll call (D120). Archiving keeps the first officer's who and when;
 * a repeat is true without writing. False when the workspace has no such live roll call.
 */
export async function setCallArchived(db: Db, c: CallChange & { on: boolean }): Promise<boolean> {
  const [done] = await db
    .update(rollCalls)
    .set(
      c.on ? { archivedAt: c.now, archivedBy: c.userId } : { archivedAt: null, archivedBy: null },
    )
    .where(and(mine(c), live, ...(c.on ? [isNull(rollCalls.archivedAt)] : [])))
    .returning({ id: rollCalls.id });
  if (done) return true;
  const [found] = await db
    .select({ id: rollCalls.id })
    .from(rollCalls)
    .where(and(mine(c), live));
  return found !== undefined;
}
