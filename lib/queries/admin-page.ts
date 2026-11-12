// What /admin reads in one go: the target event (UX review S8) and everything the page shows about it.
import { and, eq } from "drizzle-orm";

import type { Db } from "../db";
import type { Env } from "../env";
import { getDailyRead } from "../repo/daily-reads";
import { scheduledEventDone } from "../repo/events";
import { currentEvent, serverDay, targetEvent } from "../schedule";
import { events, snapshots } from "../schema";
import {
  latestManualEvent,
  latestQuota,
  latestRehearsal,
  listRuns,
  recentTicks,
  runningSnapshots,
} from "./admin";

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
    .select({ phase: snapshots.phase, status: snapshots.status })
    .from(snapshots)
    .where(eq(snapshots.eventId, row.id));
  return { ...row, phases };
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
