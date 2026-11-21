// POST /api/daily-read/retry — /admin's "Retry" on today's daily roster read (D60, D67): the same read
// as the tick's, every roster, run again once per press, only while today's read is `failed`, `partial`
// or was left `running` by a killed function, and not when it could run past the server day's end (D72).
// PIN only, same rate limiter. The answer is the read's
// outcome; no Discord line, the owner sees it on the page.
import { z } from "zod";

import { secretsOf } from "@/lib/app-context";
import { authorize } from "@/lib/auth";
import { retryDailyRead } from "@/lib/daily-read";
import { databaseDown } from "@/lib/data-unavailable";
import { errorResponse, parseQuery, withContext } from "@/lib/route";
import { serverDay } from "@/lib/schedule";
import { dayTargets } from "@/lib/tracked";

export const maxDuration = 120;

const noQuery = z.object({}).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/daily-read/retry", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    const deps = { v1: ctx.v1, now: ctx.now, secrets: secretsOf(ctx.env) };
    // D133: today's tracked set (read from the board if the tick has not yet) and the workspaces' alliances.
    const keys = { internal: ctx.internal, now: ctx.now, secret: ctx.env.WORKSPACE_KEYS_SECRET };
    // INVARIANT cache.write-invalidates-reads (D143): the board, the set and the rosters it wrote, even
    // part way, are on the public pages at their first view after the press; not when the database is
    // down, when the kept pages are all the public site has.
    let summary: Awaited<ReturnType<typeof retryDailyRead>>;
    try {
      const { targets } = await dayTargets(keys, db, serverDay(ctx.now(), ctx.env));
      summary = await retryDailyRead(deps, db, ctx.env, targets);
    } catch (error) {
      if (!databaseDown(error)) ctx.publicCache.invalidate();
      throw error;
    }
    ctx.publicCache.invalidate();
    if (summary === "too-late") return errorResponse(409, "daily_read_too_late");
    if (!summary) return errorResponse(409, "daily_read_not_retryable");
    // D141: a roster it brings gives the squads queue work again.
    ctx.wakeCache.forget();
    return Response.json({
      day: summary.day,
      status: summary.status,
      calls_used: summary.callsUsed,
      error: summary.error,
      failed: summary.failed,
      stale: summary.stale,
    });
  });
}
