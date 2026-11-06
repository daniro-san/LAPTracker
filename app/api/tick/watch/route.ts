// POST /api/tick/watch — the no-tick watcher (D45). A second cron-job.org job calls it every 15 min;
// it reads the newest tick time and posts one admin alert per silent hour. No snapshot, no quota.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { errorResponse, parseQuery, withContext } from "@/lib/route";
import { watchTicks } from "@/lib/tick";

const noQuery = z.object({}).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/tick/watch", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: true, pin: false });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    await watchTicks(ctx, db);
    return new Response(null, { status: 204 });
  });
}
