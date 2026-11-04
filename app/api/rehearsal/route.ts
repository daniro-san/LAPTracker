// POST /api/rehearsal — /admin's "Rehearse now" (plan §3.1, Phase 4): an is_test event whose BEFORE
// is due in 15 min and AFTER in 45 min; the cron ticks run it. PIN only, same rate limiter.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { createRehearsal } from "@/lib/rehearsal";
import { errorResponse, parseQuery, withContext } from "@/lib/route";

const noQuery = z.object({}).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/rehearsal", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    const result = await createRehearsal(db, ctx.now(), ctx.env);
    if (!result.ok) return errorResponse(409, `rehearsal_${result.reason.replace("-", "_")}`);
    return Response.json(
      { event_id: result.eventId, before_at: result.beforeAt, after_at: result.afterAt },
      { status: 201 },
    );
  });
}
