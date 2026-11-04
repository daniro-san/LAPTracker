// POST /api/snapshot?phase=before|after&force=0|1 — a run on demand for the current Saturday:
// /admin's "Run BEFORE/AFTER now" (x-edit-pin) or workflow_dispatch (Bearer CRON_SECRET).
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { findOrCreateEvent } from "@/lib/repo/events";
import { errorResponse, parseQuery, withContext } from "@/lib/route";
import { executeSnapshot } from "@/lib/run";
import { runResponse } from "@/lib/run-response";
import { currentEvent } from "@/lib/schedule";

export const maxDuration = 120;

const query = z
  .object({ phase: z.enum(["before", "after"]), force: z.enum(["0", "1"]).default("0") })
  .strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/snapshot", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: true, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const q = parseQuery(request, query);
    if (!q) return errorResponse(400, "bad_request");
    const event = await findOrCreateEvent(db, currentEvent(ctx.now(), ctx.env));
    const outcome = await executeSnapshot(ctx, db, {
      event,
      phase: q.phase,
      force: q.force === "1",
      origin: new URL(request.url).origin,
    });
    return runResponse(outcome);
  });
}
