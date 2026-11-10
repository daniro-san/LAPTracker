// POST /api/snapshot?phase=before|after&force=0|1[&event=<id>] — a run on demand for the target
// scheduled event (lib/schedule.ts targetEvent), or for the manual event `event` (D28): /admin's run buttons (x-edit-pin) or
// workflow_dispatch (Bearer CRON_SECRET). Any other event id is refused: the not-due guard stays.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { findOrCreateEvent, getEventInfo, scheduledEventDone } from "@/lib/repo/events";
import { errorResponse, parseQuery, withContext } from "@/lib/route";
import { executeSnapshot } from "@/lib/run";
import { runResponse } from "@/lib/run-response";
import { currentEvent, targetEvent } from "@/lib/schedule";

export const maxDuration = 120;

const query = z
  .object({
    phase: z.enum(["before", "after"]),
    force: z.enum(["0", "1"]).default("0"),
    event: z.coerce.number().int().positive().optional(),
  })
  .strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/snapshot", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: true, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const q = parseQuery(request, query);
    if (!q) return errorResponse(400, "bad_request");
    let event;
    if (q.event === undefined) {
      const now = ctx.now();
      const done = await scheduledEventDone(db, currentEvent(now, ctx.env).eventAtUtc);
      event = await findOrCreateEvent(db, targetEvent(now, ctx.env, done));
    } else {
      event = await getEventInfo(db, q.event);
      if (!event?.manual) return errorResponse(404, "event_not_found");
    }
    const outcome = await executeSnapshot(ctx, db, {
      event,
      phase: q.phase,
      force: q.force === "1",
      origin: new URL(request.url).origin,
    });
    return runResponse(outcome);
  });
}
