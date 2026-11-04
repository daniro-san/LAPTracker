// POST /api/tick — the scheduler's entry point (plan §3.1). GitHub Actions calls it every 15 min
// Fri–Sun; it runs at most one due action per call and answers 204 when nothing is due.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { createRepo } from "@/lib/repo";
import { claimQuotaCheck, findOrCreateEvent } from "@/lib/repo/events";
import { errorResponse, parseQuery, withContext } from "@/lib/route";
import { executeSnapshot, quotaReport } from "@/lib/run";
import { runResponse } from "@/lib/run-response";
import { dueActions } from "@/lib/schedule";

export const maxDuration = 120;

const noQuery = z.object({}).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/tick", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { allowPin: false });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    const now = ctx.now();
    // Earliest first; a done action falls through to the next, and only one ever runs.
    for (const due of dueActions(now, ctx.env)) {
      const event = await findOrCreateEvent(db, due.event.name, due.event.eventAtUtc);
      if (due.action === "quota-check") {
        if (!(await claimQuotaCheck(db, event.id, now))) continue;
        const report = await quotaReport(ctx, db, { always: true });
        return Response.json({ action: due.action, event_id: event.id, ...report });
      }
      // INVARIANT tick.once-per-phase: the tick never re-runs a phase that has a snapshot row.
      if (await createRepo(db).findSnapshot(event.id, due.action)) continue;
      const outcome = await executeSnapshot(ctx, db, {
        eventId: event.id,
        phase: due.action,
        force: false,
        origin: new URL(request.url).origin,
      });
      return runResponse(outcome);
    }
    return new Response(null, { status: 204 });
  });
}
