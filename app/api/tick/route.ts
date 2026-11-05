// POST /api/tick — the scheduler's entry point (plan §3.1). GitHub Actions calls it every 15 min,
// every day; it does at most one thing per call and answers 204 when nothing is due.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { errorResponse, parseQuery, withContext } from "@/lib/route";
import { runResponse } from "@/lib/run-response";
import { runTick } from "@/lib/tick";

export const maxDuration = 120;

const noQuery = z.object({}).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/tick", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: true, pin: false });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    const tick = await runTick(ctx, db, new URL(request.url).origin);
    switch (tick.kind) {
      case "idle":
        return new Response(null, { status: 204 });
      case "run":
        return runResponse(tick.outcome);
      case "quota-check":
        return Response.json({
          action: "quota-check",
          event_id: tick.eventId,
          remaining: tick.remaining,
        });
      case "rehearsal":
        return Response.json({
          action: "rehearsal",
          slot_at: tick.slotAt,
          ...(tick.result.ok ? { event_id: tick.result.eventId } : { skipped: tick.result.reason }),
        });
    }
  });
}
