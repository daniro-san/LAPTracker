// The daily roster reads (D60) as /admin/runs lists them, next to the snapshot runs: one entry per
// server day, with the alliances that failed or were stale and, for a failure, its error and what the
// upstream answered (D61). One read's page adds its run_logs lines and its upstream calls. Never the
// member arrays.
import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import { ALLIANCES } from "../../config/alliances";
import type { Db } from "../db";
import { dailyReads, dailyRosters, runLogs } from "../schema";
import type { UpstreamDetail } from "../sources/types";
import { DEADLINE_ERROR, runTrace } from "./admin";

/** For /admin's error details: app/ cannot import lib/sources (docs/ARCHITECTURE.md). */
export type { UpstreamDetail };

const readFields = {
  day: dailyReads.day,
  status: dailyReads.status,
  startedAt: dailyReads.startedAt,
  finishedAt: dailyReads.finishedAt,
  callsUsed: dailyReads.callsUsed,
  quotaRemainingBefore: dailyReads.quotaRemainingBefore,
  error: dailyReads.error,
};

/** The failed or stale alliances of these days: identity, the flag, the error and its detail. */
function problemsOf(db: Db, days: string[]) {
  return db
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
}

type Problems = Awaited<ReturnType<typeof problemsOf>>;

function withProblems<
  R extends { day: string; startedAt: Date; finishedAt: Date | null; error: string | null },
>(r: R, problems: Problems) {
  return {
    ...r,
    durationMs: r.finishedAt && r.finishedAt.getTime() - r.startedAt.getTime(),
    deadline: r.error === DEADLINE_ERROR,
    problems: problems.filter((p) => p.day === r.day),
  };
}

export async function listDailyReads(db: Db, limit = 60) {
  const rows = await db
    .select(readFields)
    .from(dailyReads)
    .orderBy(desc(dailyReads.startedAt))
    .limit(limit);
  const problems =
    rows.length === 0
      ? []
      : await problemsOf(
          db,
          rows.map((r) => r.day),
        );
  return rows.map((r) => withProblems(r, problems));
}

/** One daily read for /admin/runs/daily/[day]: the list's entry, its log lines (oldest first, every
 * attempt) and its upstream calls (the latest attempt, as runTrace reads a snapshot's). */
export async function getDailyRun(db: Db, day: string) {
  const [row] = await db.select(readFields).from(dailyReads).where(eq(dailyReads.day, day));
  if (!row) return null;
  const logs = await db
    .select({
      id: runLogs.id,
      at: runLogs.at,
      level: runLogs.level,
      code: runLogs.code,
      unionId: runLogs.unionId,
      data: runLogs.data,
    })
    .from(runLogs)
    .where(eq(runLogs.readDay, day))
    .orderBy(asc(runLogs.at), asc(runLogs.id));
  const tagRows = await db
    .select({ unionId: dailyRosters.unionId, tag: dailyRosters.tag })
    .from(dailyRosters)
    .where(eq(dailyRosters.readDay, day));
  // The configured tags first: an alliance the read never reached has a line but no row.
  const tags = new Map<number, string | null>([
    ...ALLIANCES.map((a) => [a.unionId, a.tag] as const),
    ...tagRows.map((t) => [t.unionId, t.tag] as const),
  ]);
  return {
    run: withProblems(row, await problemsOf(db, [day])),
    logs,
    tags,
    trace: runTrace(logs, tags, row.startedAt),
  };
}
