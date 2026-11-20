// /admin's squads read progress (D117, amendment 2026-11-19b): each workspace alliance's row of one day,
// as counts only (how far the pass got, retries waiting, failed calls, the quota left, the last batch's
// time). Owner only
// (PIN); no uid, name or squad.
import { and, eq, max, sql } from "drizzle-orm";

import { RUN_STALE_AFTER_MS } from "../compute";
import type { Db } from "../db";
import { dailyRosters, runLogs, workspaces } from "../schema";
import { squadReads } from "../schema-squads";

export interface SquadsProgress {
  unionId: number;
  status: "running" | "done" | "stopped" | "skipped";
  /** Members the pass has called, in uid order (a failed call counts: its retry comes after the pass). */
  reached: number;
  members: number;
  /** Members whose call failed in the pass and wait for their one retry. */
  retrying: number;
  failed: number;
  quotaRemaining: number | null;
  reason: string | null;
  /** A batch holds the day's claim now. */
  batchRunning: boolean;
  /** The newest `squads.batch` line of this alliance's workspace, or null before any batch ended. */
  lastBatchAt: Date | null;
}

export async function squadsProgress(db: Db, day: string, now: Date): Promise<SquadsProgress[]> {
  const [rows, rosters, batches] = await Promise.all([
    db.select().from(squadReads).where(eq(squadReads.day, day)),
    db
      .select({ unionId: dailyRosters.unionId, uids: dailyRosters.memberUids })
      .from(dailyRosters)
      .where(eq(dailyRosters.readDay, day)),
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
    const uids = rosters.find((x) => x.unionId === r.unionId)?.uids ?? [];
    const after = r.afterUid;
    return {
      unionId: r.unionId,
      status: r.status,
      reached: after === null ? 0 : uids.filter((uid) => uid <= after).length,
      members: r.members,
      retrying: r.retryUids.length,
      failed: r.failed,
      quotaRemaining: r.quotaRemaining,
      reason: r.reason,
      batchRunning: r.batchAt !== null && r.batchAt.getTime() > stale,
      lastBatchAt: batches.find((b) => b.unionId === r.unionId)?.at ?? null,
    };
  });
}
