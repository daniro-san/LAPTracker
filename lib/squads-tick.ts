// The tick's squads batch (D117, amendment 2026-11-19; D132). The scheduler is cron-job.org (D30): it POSTs
// /api/tick every 15 minutes, at :00, :15, :30 and :45, and waits 30 s. Every tick starts the next batch
// of each alliance's squads queue after its answer (`after`), on its own database connection: the
// request's connection is closed with the response. Same claim and guards as /api/squads-read
// (runSquadsBatch): the per-call save, the day's 120 calls, the KvK reserve, the batch's deadline.
// /admin's "Run the squads read now" takes the same path (D117, amendment 2026-11-19b).
import { after } from "next/server";

import { secretsOf, type AppContext } from "./app-context";
import { recordAppError } from "./app-errors";
import { shieldTick } from "./shield-tick";
import { SQUADS_BATCH_MS, squadsQueueDay } from "./squads";
import { runSquadsBatch, type SquadsRun } from "./squads-read";

/**
 * D137: what the tick's `after` may spend in all, from its start: the tick's own work takes at most 100 s of
 * the function's 300 s, so this leaves room to spare.
 */
export const AFTER_BUDGET_MS = 180_000;

/**
 * /admin's press (D117, amendment 2026-11-19b): batches of one workspace or all, on the route's
 * app_errors rows; a further batch starts while members' turns have come and it would end within
 * `budgetMs`.
 */
export interface SquadsPress {
  run: SquadsRun;
  route: string;
  budgetMs: number;
}

/**
 * The tick's one batch, or a press's batches, on its own connection; an error becomes an app_errors row (a
 * code, never a member).
 */
export async function squadsBatch(
  ctx: AppContext,
  press?: SquadsPress,
  /** The tick's origin: set, the Raid Shield check's due read runs after the batch (D137). */
  origin?: string,
): Promise<void> {
  const { db, close } = ctx.openDb();
  try {
    const deps = {
      v1: ctx.v1,
      now: ctx.now,
      fetch: ctx.fetch,
      env: ctx.env,
      secrets: secretsOf(ctx.env),
    };
    const startedAt = ctx.now().getTime();
    for (;;) {
      const outcome = await runSquadsBatch(deps, db, press?.run);
      // A batch that made no call ends the press too: the next one would not get further.
      if (!press || outcome.kind === "idle" || !outcome.more || outcome.calls === 0) break;
      if (ctx.now().getTime() - startedAt + SQUADS_BATCH_MS > press.budgetMs) break;
    }
    if (origin !== undefined)
      await shieldTick({ ...deps, origin }, db, startedAt + AFTER_BUDGET_MS);
  } catch (error) {
    const route = press?.route ?? "/api/tick";
    await recordAppError(ctx, { route, kind: "after", digest: null, error, handled: true });
  } finally {
    await close();
  }
}

/**
 * Starts a batch after the tick's answer on every tick (D132), unless one would cross the quota reset at
 * 00:00 UTC, and the Raid Shield check's due read after it (D137); true when it was scheduled. runSquadsBatch then waits for the day's read, takes the claim
 * and finds nothing to do on most ticks of a day.
 */
export function scheduleSquadsBatch(ctx: AppContext, origin: string): boolean {
  if (!squadsQueueDay(ctx.now(), ctx.env)) return false;
  after(() => squadsBatch(ctx, undefined, origin));
  return true;
}
