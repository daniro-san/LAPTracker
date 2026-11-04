// POST /api/snapshot?phase=before|after&force=0|1&test=0|1 — a run on demand: /admin's "Run now"
// (x-edit-pin) or workflow_dispatch (Bearer CRON_SECRET). test=1 runs against a new is_test event
// dated now (plan Phase 7 dry run), so a weekday test never touches the coming Saturday.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { createTestEvent, findOrCreateEvent } from "@/lib/repo/events";
import { errorResponse, parseQuery, withContext } from "@/lib/route";
import { executeSnapshot } from "@/lib/run";
import { runResponse } from "@/lib/run-response";
import { currentEvent } from "@/lib/schedule";

export const maxDuration = 120;

const flag = z.enum(["0", "1"]).default("0");
const query = z.object({ phase: z.enum(["before", "after"]), force: flag, test: flag }).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/snapshot", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { allowPin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const q = parseQuery(request, query);
    if (!q) return errorResponse(400, "bad_request");
    const now = ctx.now();
    const isTest = q.test === "1";
    const event = currentEvent(now, ctx.env);
    const eventId = isTest
      ? await createTestEvent(db, `Test event ${now.toISOString()}`, now)
      : (await findOrCreateEvent(db, event.name, event.eventAtUtc)).id;
    const outcome = await executeSnapshot(ctx, db, {
      eventId,
      phase: q.phase,
      force: q.force === "1",
      origin: new URL(request.url).origin,
    });
    return runResponse(outcome);
  });
}
