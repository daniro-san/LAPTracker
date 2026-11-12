// POST /api/daily-read/retry — /admin's "Retry" on today's failed daily roster read (D60 amendment):
// the same read as the tick's, run again once per press, only while today's read is `failed`. PIN only,
// same rate limiter. The answer is the read's outcome; no Discord line, the owner sees it on the page.
import { z } from "zod";

import { DAILY_ROSTER_IDS } from "@/config/alliances";
import { authorize } from "@/lib/auth";
import { retryDailyRead } from "@/lib/daily-read";
import { errorResponse, parseQuery, withContext } from "@/lib/route";
import { serverDay } from "@/lib/schedule";

export const maxDuration = 120;

const noQuery = z.object({}).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/daily-read/retry", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    const summary = await retryDailyRead(ctx, db, serverDay(ctx.now(), ctx.env), DAILY_ROSTER_IDS);
    if (!summary) return errorResponse(409, "daily_read_not_failed");
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
