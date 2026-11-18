// A notice's delete, its Undo and a restore from the trash (issue 411, D118): a soft delete on the notices
// row, with who, when and the request id (D100), and the last restore's who, when and request id. The row and its edits stay, so Home's activity keeps the title; every
// other read leaves the notice out (`live` in ./notices).
import { and, eq, gt, isNotNull, or, sql } from "drizzle-orm";

import type { Db } from "../db";
import { notices } from "../schema-notices";
import { live } from "./notices";

export interface NoticeDelete {
  workspaceId: number;
  id: number;
  userId: number;
  requestId: string;
  now: Date;
}

/**
 * Deletes a live notice (D118). A retry under the same request id finds its own delete and is true without
 * writing, also after that delete was undone (a late replay must not delete again); false when the
 * workspace has no such live notice.
 */
export async function markNoticeDeleted(db: Db, d: NoticeDelete): Promise<boolean> {
  const mine = and(eq(notices.workspaceId, d.workspaceId), eq(notices.id, d.id));
  const [done] = await db
    .update(notices)
    .set({ deletedAt: d.now, deletedBy: d.userId, deleteRequestId: d.requestId })
    .where(and(mine, live, sql`${notices.deleteRequestId} is distinct from ${d.requestId}`))
    .returning({ id: notices.id });
  if (done) return true;
  const [again] = await db
    .select({ id: notices.id })
    .from(notices)
    .where(and(mine, eq(notices.deleteRequestId, d.requestId)));
  return again !== undefined;
}

/**
 * Restores a deleted notice from the trash (D118): any officer of the workspace, at any time, recorded with
 * who, when and the request id. A repeat of the same restore is true without writing. False when the
 * workspace has no such deleted notice.
 */
export async function restoreDeletedNotice(db: Db, d: NoticeDelete): Promise<boolean> {
  const mine = and(eq(notices.workspaceId, d.workspaceId), eq(notices.id, d.id));
  const [done] = await db
    .update(notices)
    .set({
      deletedAt: null,
      restoredAt: d.now,
      restoredBy: d.userId,
      restoreRequestId: d.requestId,
    })
    .where(
      and(
        mine,
        isNotNull(notices.deletedAt),
        sql`${notices.restoreRequestId} is distinct from ${d.requestId}`,
      ),
    )
    .returning({ id: notices.id });
  if (done) return true;
  const [again] = await db
    .select({ id: notices.id })
    .from(notices)
    .where(and(mine, eq(notices.restoreRequestId, d.requestId)));
  return again !== undefined;
}

/** Whether the workspace has this notice in the trash: a save to it says so (D118), not "not found". */
export async function noticeIsDeleted(db: Db, workspaceId: number, id: number): Promise<boolean> {
  const [row] = await db
    .select({ id: notices.id })
    .from(notices)
    .where(
      and(eq(notices.workspaceId, workspaceId), eq(notices.id, id), isNotNull(notices.deletedAt)),
    );
  return row !== undefined;
}

/**
 * Undoes the officer's own delete made under `requestId` since `since` (D118): the notice is back in every
 * list. A repeat of an Undo that worked is true again. False otherwise (someone else's, or too late).
 */
export async function unmarkNoticeDeleted(db: Db, d: NoticeDelete, since: Date): Promise<boolean> {
  const [done] = await db
    .update(notices)
    .set({ deletedAt: null })
    .where(
      and(
        eq(notices.workspaceId, d.workspaceId),
        eq(notices.id, d.id),
        eq(notices.deleteRequestId, d.requestId),
        eq(notices.deletedBy, d.userId),
        or(live, gt(notices.deletedAt, since)),
      ),
    )
    .returning({ id: notices.id });
  return done !== undefined;
}
