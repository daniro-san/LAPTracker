// A notice's delete and its Undo (issue 411, D118): a soft delete on the notices row, with who, when and the
// delete sheet's request id (D100). The row and its edits stay, so Home's activity keeps the title; every
// other read leaves the notice out (`live` in ./notices).
import { and, eq, gt, or } from "drizzle-orm";

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
 * Deletes a live notice (D118). A retry under the same request id finds its own delete and is true too;
 * false when the workspace has no such live notice.
 */
export async function markNoticeDeleted(db: Db, d: NoticeDelete): Promise<boolean> {
  const mine = and(eq(notices.workspaceId, d.workspaceId), eq(notices.id, d.id));
  const [done] = await db
    .update(notices)
    .set({ deletedAt: d.now, deletedBy: d.userId, deleteRequestId: d.requestId })
    .where(and(mine, live))
    .returning({ id: notices.id });
  if (done) return true;
  const [again] = await db
    .select({ id: notices.id })
    .from(notices)
    .where(and(mine, eq(notices.deleteRequestId, d.requestId)));
  return again !== undefined;
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
