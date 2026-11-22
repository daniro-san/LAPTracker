// feedback table (D155, issue 713): one row per send from the desk or the board, the owner's status on it,
// and the daily purge after 180 days. Who sent it is never stored.
import { eq, lt } from "drizzle-orm";

import type { Db } from "../db";
import { feedback, type FeedbackStatus } from "../schema-feedback";
import { DAY_KEY_PREFIX } from "./auth-attempts";

export type FeedbackRow = Omit<typeof feedback.$inferInsert, "id" | "status">;

/** How long a row is kept (D155). */
export const FEEDBACK_DAYS = 180;

/** The workspace's daily count of sends in auth_attempts; deleted with the workspace (D125). */
export const feedbackLimitKey = (workspaceId: number) =>
  `${DAY_KEY_PREFIX}feedback:ws:${workspaceId}`;

export async function insertFeedback(db: Db, row: FeedbackRow): Promise<void> {
  await db.insert(feedback).values(row);
}

/** The owner's status on one row; false when there is no such row. */
export async function setFeedbackStatus(
  db: Db,
  id: number,
  status: FeedbackStatus,
): Promise<boolean> {
  const rows = await db
    .update(feedback)
    .set({ status })
    .where(eq(feedback.id, id))
    .returning({ id: feedback.id });
  return rows.length > 0;
}

/**
 * INVARIANT feedback.purged-180-days: deletes the rows created more than 180 days before `now`, through
 * feedback_created_at_idx. Returns how many went. Run once a day by the tick, beside app_errors' purge.
 */
export async function purgeOldFeedback(db: Db, now: Date): Promise<number> {
  const before = new Date(now.getTime() - FEEDBACK_DAYS * 86_400_000);
  const gone = await db
    .delete(feedback)
    .where(lt(feedback.createdAt, before))
    .returning({ id: feedback.id });
  return gone.length;
}
