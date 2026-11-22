// What /admin reads in one go: the target event (UX review S8) and everything the page shows about it.
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";

import { RUN_DEADLINE_MS } from "../compute";
import type { Db } from "../db";
import type { Env } from "../env";
import { getDailyRead } from "../repo/daily-reads";
import { scheduledEventDone } from "../repo/events";
import { currentEvent, serverDay, targetEvent } from "../schedule";
import { dailyReads, events, runLogs, snapshots } from "../schema";
import {
  latestManualEvent,
  latestRehearsal,
  listRuns,
  recentTicks,
  runningSnapshots,
} from "./admin";
import { phaseColumn, phaseSnapshot } from "./visibility";

/** The scheduled event at this time, once the scheduler has made its row (a day before its Before),
 * with the status of each snapshot it has. */
export async function scheduledEvent(db: Db, eventAtUtc: Date) {
  const [row] = await db
    .select({ id: events.id, name: events.name })
    .from(events)
    .where(
      and(eq(events.eventAtUtc, eventAtUtc), eq(events.manual, false), eq(events.isTest, false)),
    );
  if (!row) return null;
  const phases = await db
    .select({ phase: phaseColumn, status: snapshots.status })
    .from(snapshots)
    .where(and(eq(snapshots.eventId, row.id), phaseSnapshot));
  return { ...row, phases };
}

/**
 * The newest daily read's first quota check: the first `v1.fetch` line on the quota endpoint in its run log
 * (`run_logs_read_day_idx`), when it belongs to the day's first read. That read is the first call of the UTC
 * day (01:30 UTC), so its check comes before the day's spend. A retry overwrites `daily_reads.quota_remaining_
 * before` and `started_at` with its own reading, taken after the spend, but only adds log lines after the first
 * read's (D67, D72), so the first read's line stays first. A check counts as the first read's only within its
 * deadline of the day's first log line (`RUN_DEADLINE_MS`): when the first read's check was cut and left no
 * line, a retry's check is not taken for it. Null then, or when that check got no number: no later reading
 * stands in. "Needs you" calls only this reading low (issue 585): a snapshot's reading after an event day's
 * runs is low by design.
 */
export async function morningQuota(db: Db): Promise<{ remaining: number | null; at: Date } | null> {
  const day = sql`(select max(day) from ${dailyReads})`;
  const firstLine = sql`(select min(at) from ${runLogs} where read_day = ${day})`;
  const [line] = await db
    .select({ at: runLogs.at, remaining: sql<string | null>`${runLogs.data}->>'quota_remaining'` })
    .from(runLogs)
    .where(
      and(
        eq(runLogs.readDay, day),
        eq(runLogs.code, "v1.fetch"),
        sql`${runLogs.data}->>'endpoint' = 'quota'`,
        sql`${runLogs.at} <= ${firstLine} + ${`${RUN_DEADLINE_MS} milliseconds`}::interval`,
      ),
    )
    .orderBy(asc(runLogs.at), asc(runLogs.id))
    .limit(1);
  if (!line) return null;
  return { remaining: line.remaining === null ? null : Number(line.remaining), at: line.at };
}

/** The newest requests-left reading: after a snapshot run, or the daily roster read's quota check
 * (D60), whichever ran last; and the daily read's first one of its day (`morningQuota`). */
export async function latestQuota(db: Db) {
  const [[run], [daily], morning] = await Promise.all([
    db
      .select({ remaining: snapshots.quotaRemainingAfter, at: snapshots.startedAt })
      .from(snapshots)
      .where(isNotNull(snapshots.quotaRemainingAfter))
      .orderBy(desc(snapshots.startedAt))
      .limit(1),
    db
      .select({ remaining: dailyReads.quotaRemainingBefore, at: dailyReads.startedAt })
      .from(dailyReads)
      .where(isNotNull(dailyReads.quotaRemainingBefore))
      .orderBy(desc(dailyReads.startedAt))
      .limit(1),
    morningQuota(db),
  ]);
  const newest = !run || !daily ? (run ?? daily ?? null) : daily.at > run.at ? daily : run;
  return { newest, morning };
}

/** The target event first: the nearest one until both its snapshots are done, then the next one. */
export async function loadAdminPage(db: Db, now: Date, env: Env) {
  const done = await scheduledEventDone(db, currentEvent(now, env).eventAtUtc);
  const target = targetEvent(now, env, done);
  return [
    target,
    ...(await Promise.all([
      latestRehearsal(db, env.SNAPSHOT_WINDOW_MIN),
      latestQuota(db),
      latestManualEvent(db),
      runningSnapshots(db, now),
      listRuns(db, 10),
      scheduledEvent(db, target.eventAtUtc),
      recentTicks(db),
      getDailyRead(db, serverDay(now, env)),
    ])),
  ] as const;
}
