// The daily roster reads (D60) as /admin/runs lists them, next to the snapshot runs: one entry per
// server day, with the alliances that failed or were stale and, for a failure, its error and what the
// upstream answered (D61). Never the member arrays.
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import type { Db } from "../db";
import { dailyReads, dailyRosters } from "../schema";
import type { UpstreamDetail } from "../sources/types";
import { DEADLINE_ERROR } from "./admin";

/** For /admin's error details: app/ cannot import lib/sources (docs/ARCHITECTURE.md). */
export type { UpstreamDetail };

export async function listDailyReads(db: Db, limit = 60) {
  const rows = await db
    .select({
      day: dailyReads.day,
      status: dailyReads.status,
      startedAt: dailyReads.startedAt,
      finishedAt: dailyReads.finishedAt,
      callsUsed: dailyReads.callsUsed,
      quotaRemainingBefore: dailyReads.quotaRemainingBefore,
      error: dailyReads.error,
    })
    .from(dailyReads)
    .orderBy(desc(dailyReads.startedAt))
    .limit(limit);
  const days = rows.map((r) => r.day);
  const problems =
    days.length === 0
      ? []
      : await db
          .select({
            day: dailyRosters.readDay,
            unionId: dailyRosters.unionId,
            tag: dailyRosters.tag,
            failed: sql<boolean>`${dailyRosters.error} is not null`,
            error: dailyRosters.error,
            errorDetail: sql<UpstreamDetail | null>`${dailyRosters.errorDetail}`,
          })
          .from(dailyRosters)
          .where(
            and(
              inArray(dailyRosters.readDay, days),
              or(eq(dailyRosters.isFresh, false), isNotNull(dailyRosters.error)),
            ),
          )
          .orderBy(asc(dailyRosters.unionId));
  return rows.map((r) => ({
    ...r,
    durationMs: r.finishedAt && r.finishedAt.getTime() - r.startedAt.getTime(),
    deadline: r.error === DEADLINE_ERROR,
    problems: problems.filter((p) => p.day === r.day),
  }));
}
