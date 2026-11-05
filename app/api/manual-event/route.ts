// POST /api/manual-event {name} — /admin's "Create manual event" (D28): a public event with no
// schedule, run only by /admin's buttons through POST /api/snapshot?event=<id>. PIN only.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { createManualEvent } from "@/lib/repo/events";
import { errorResponse, withContext } from "@/lib/route";

const body = z.object({ name: z.string().trim().min(1).max(80) }).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/manual-event", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const event = await createManualEvent(db, parsed.data.name, ctx.now());
    return Response.json({ event_id: event.id }, { status: 201 });
  });
}
