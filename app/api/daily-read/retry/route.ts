// POST /api/daily-read/retry — /admin's "Retry" on today's daily roster read (D60, D67): the same read
// as the tick's, every roster, run again once per press, only while today's read is `failed`, `partial`
// or was left `running` by a killed function, and not when it could run past the server day's end (D72).
// PIN only, same rate limiter. The answer is the read's
// outcome; no Discord line, the owner sees it on the page.
import { z } from "zod";

import { DAILY_ROSTER_IDS } from "@/config/alliances";
import { secretsOf } from "@/lib/app-context";
import { authorize } from "@/lib/auth";
import { RUN_DEADLINE_MS } from "@/lib/compute";
import { retryDailyRead } from "@/lib/daily-read";
import { errorResponse, parseQuery, withContext } from "@/lib/route";
import { endsInServerDay, serverDay } from "@/lib/schedule";

export const maxDuration = 120;

const noQuery = z.object({}).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/daily-read/retry", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    // INVARIANT daily-read.ends-before-midnight: a Retry that could run past 00:00 would store rosters
    // read after the reset under the day before; the day keeps its gap instead (D72).
    if (!endsInServerDay(ctx.now(), RUN_DEADLINE_MS, ctx.env))
      return errorResponse(409, "daily_read_too_late");
    const deps = { v1: ctx.v1, now: ctx.now, secrets: secretsOf(ctx.env) };
    const summary = await retryDailyRead(deps, db, serverDay(ctx.now(), ctx.env), DAILY_ROSTER_IDS);
    if (!summary) return errorResponse(409, "daily_read_not_retryable");
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
