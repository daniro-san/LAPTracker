// /admin's squads read progress (D117, amendment 2026-11-19b; D132): each workspace alliance's day of the
// queue, as counts only (members read, waiting to retry, failed, when the next try comes, the quota left,
// the last batch's time). Owner only (PIN); no uid, name or squad.
import { and, eq, max, sql } from "drizzle-orm";

import { RUN_STALE_AFTER_MS } from "../compute";
import type { Db } from "../db";
import { queueCounts } from "../repo/squad-queue";
import { runLogs, workspaces } from "../schema";
import { squadReads } from "../schema-squads";

export interface SquadsProgress {
  unionId: number;
  status: "running" | "done" | "stopped" | "skipped";
  /** Members read today: one answer each. */
  read: number;
  /** Members in the day's queue (members who joined during the day included). */
  members: number;
  /** Members waiting for another attempt after a 5xx or no answer. */
  retrying: number;
  /** Members not read yet and not given up on: their turn has come (`dueNow`) or comes at `nextAt`. */
  waiting: number;
  dueNow: number;
  /** Members not read today: 3 attempts without an answer, or a failure not tried again. */
  failed: number;
  /** When the next waiting member's turn comes, when it is later than now. */
  nextAt: Date | null;
  quotaRemaining: number | null;
  reason: string | null;
  /** A batch holds the day's claim now. */
  batchRunning: boolean;
  /** The newest `squads.batch` line of this alliance's workspace, or null before any batch ended. */
  lastBatchAt: Date | null;
}

export async function squadsProgress(db: Db, day: string, now: Date): Promise<SquadsProgress[]> {
  const [rows, queues, batches] = await Promise.all([
    db.select().from(squadReads).where(eq(squadReads.day, day)),
    queueCounts(db, day, now),
    // Each line names its workspace by slug (issue 452).
    db
      .select({ unionId: workspaces.unionId, at: max(runLogs.at) })
      .from(runLogs)
      .innerJoin(workspaces, eq(workspaces.slug, sql`${runLogs.data}->>'workspace'`))
      .where(and(eq(runLogs.readDay, day), eq(runLogs.code, "squads.batch")))
      .groupBy(workspaces.unionId),
  ]);
  const stale = now.getTime() - RUN_STALE_AFTER_MS;
  return rows.map((r) => {
    // A row with no queue yet: the day's first batch was skipped before it made one.
    const none = {
      done: 0,
      members: r.members,
      retrying: 0,
      waiting: 0,
      dueNow: 0,
      failed: 0,
      nextAt: null,
    };
    const q = queues.find((x) => x.unionId === r.unionId) ?? none;
    return {
      unionId: r.unionId,
      status: r.status,
      read: q.done,
      members: q.members,
      retrying: q.retrying,
      waiting: q.waiting,
      dueNow: q.dueNow,
      failed: q.failed,
      nextAt: q.nextAt,
      quotaRemaining: r.quotaRemaining,
      reason: r.reason,
      batchRunning: r.batchAt !== null && r.batchAt.getTime() > stale,
      lastBatchAt: batches.find((b) => b.unionId === r.unionId)?.at ?? null,
    };
  });
}
