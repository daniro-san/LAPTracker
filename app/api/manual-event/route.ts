// POST /api/manual-event — /admin's "Start a manual round" (D28): a public event with no schedule,
// named "Manual round <date>" until renamed, run only by /admin's buttons through
// POST /api/snapshot?event=<id>. PIN only.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { createManualEvent } from "@/lib/repo/events";
import { errorResponse, parseQuery, withContext } from "@/lib/route";

const noQuery = z.object({}).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/manual-event", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    const now = ctx.now();
    const event = await createManualEvent(
      db,
      `Manual round ${now.toISOString().slice(0, 10)}`,
      now,
    );
    return Response.json({ event_id: event.id }, { status: 201 });
  });
}
