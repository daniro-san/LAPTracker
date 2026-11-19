// The tick's squads batch (D117, amendment 2026-11-19). The scheduler is cron-job.org (D30): it POSTs
// /api/tick every 15 minutes, at :00, :15, :30 and :45, and waits 30 s. GitHub's schedule fires only a few
// times a day, so tick.yml's chained POST /api/squads-read cannot be relied on. So the tick starts the
// night's next squads batch itself, after its answer (`after`), on its own database connection: the
// request's connection is closed with the response. Same claim and guards as /api/squads-read
// (runSquadsBatch): the per-call progress save, the day's 120 calls, the KvK reserve, the 100 s deadline.
import { after } from "next/server";

import { secretsOf, type AppContext } from "./app-context";
import { recordAppError } from "./app-errors";
import { RUN_DEADLINE_MS } from "./compute";
import { dailyReadDue, endsInServerDay, type ScheduleConfig } from "./schedule";
import { runSquadsBatch } from "./squads-read";

/**
 * A squads batch may start at `now`: inside the daily read's window (DAILY_ROSTER_AT + 45 min) and ending
 * before 00:00 server time (no batch starts after 23:58:20). Pure: no database. runSquadsBatch itself then
 * waits for the day's read and takes the claim.
 */
export const squadsBatchDue = (now: Date, cfg: ScheduleConfig): boolean =>
  dailyReadDue(now, cfg) !== null && endsInServerDay(now, RUN_DEADLINE_MS, cfg);

/** One batch on its own connection; an error becomes an app_errors row (a code, never a member). */
export async function squadsBatch(ctx: AppContext): Promise<void> {
  const { db, close } = ctx.openDb();
  try {
    const deps = {
      v1: ctx.v1,
      now: ctx.now,
      fetch: ctx.fetch,
      env: ctx.env,
      secrets: secretsOf(ctx.env),
    };
    await runSquadsBatch(deps, db);
  } catch (error) {
    await recordAppError(ctx, { route: "/api/tick", kind: "after", digest: null, error });
  } finally {
    await close();
  }
}

/** Starts the batch after the tick's answer when one is due; true when it was scheduled. */
export function scheduleSquadsBatch(ctx: AppContext): boolean {
  if (!squadsBatchDue(ctx.now(), ctx.env)) return false;
  after(() => squadsBatch(ctx));
  return true;
}
