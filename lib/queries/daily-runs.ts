// The daily roster reads (D60) as /admin/runs lists them, next to the snapshot runs: one entry per
// server day, with the alliances that failed or were stale and, for a failure, its error and what the
// upstream answered (D61). One read's page adds its run_logs lines and its upstream calls. Never the
// member arrays.
import {
  and,
  asc,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  lt,
  notExists,
  or,
  sql,
} from "drizzle-orm";

import { FRESH_MAX_AGE_MS } from "../collector-rows";
import type { Db } from "../db";
import { allianceLabels } from "../repo/alliances";
import { dailyReads, dailyRosters, runLogs } from "../schema";
import { allianceLookups, trackedSets } from "../schema-alliances";
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

/** The failed or stale alliances of these days: identity, the flag, the error and its detail. Stale
 * includes a roster a retry kept from an earlier read, once it is more than 20 minutes older than the
 * start of the day's latest read (D67), as the read's own outcome counts it. A "Get today's details" roster
 * stored under the day (D133) is not the read's: an alliance the day has a lookup claim for counts only when
 * it is one of the targets the latest attempt stored when it claimed the day (issue 625), so a roster the read
 * never reached still counts. A day read before issue 625 has none: there it counts when it is in the day's
 * tracked set, or when the read wrote a line for it (a workspace's alliance it read). */
function problemsOf(db: Db, days: string[]) {
  const lookedUp = db
    .select({ one: sql`1` })
    .from(allianceLookups)
    .where(
      and(
        eq(allianceLookups.unionId, dailyRosters.unionId),
        eq(allianceLookups.day, dailyRosters.readDay),
      ),
    );
  const tracked = db
    .select({ one: sql`1` })
    .from(trackedSets)
    .where(
      and(
        eq(trackedSets.day, dailyRosters.readDay),
        sql`${dailyRosters.unionId} = any(${trackedSets.allianceIds})`,
      ),
    );
  const readByRun = db
    .select({ one: sql`1` })
    .from(runLogs)
    .where(
      and(eq(runLogs.readDay, dailyRosters.readDay), eq(runLogs.unionId, dailyRosters.unionId)),
    );
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
    .innerJoin(dailyReads, eq(dailyReads.day, dailyRosters.readDay))
    .where(
      and(
        inArray(dailyRosters.readDay, days),
        or(
          notExists(lookedUp),
          sql`${dailyRosters.unionId} = any(${dailyReads.targetIds})`,
          and(isNull(dailyReads.targetIds), or(exists(tracked), exists(readByRun))),
        ),
        or(
          eq(dailyRosters.isFresh, false),
          isNotNull(dailyRosters.error),
          lt(
            dailyRosters.sourceUpdatedAt,
            sql`${dailyReads.startedAt} - make_interval(secs => ${FRESH_MAX_AGE_MS / 1000})`,
          ),
        ),
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
  // The day's labels first (D133): an alliance the read never reached has a line but no row.
  const lineIds = [...new Set(logs.flatMap((l) => (l.unionId === null ? [] : [l.unionId])))];
  const labels = await allianceLabels(db, lineIds);
  const tags = new Map<number, string | null>([
    ...[...labels.entries()].map(([id, l]) => [id, l.tag] as const),
    ...tagRows.map((t) => [t.unionId, t.tag] as const),
  ]);
  return {
    run: withProblems(row, await problemsOf(db, [day])),
    logs,
    tags,
    trace: runTrace(logs, tags, row.startedAt),
  };
}
