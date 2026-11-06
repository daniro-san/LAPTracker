// POST /api/manual-event/rename {event_id, name} — /admin's "Rename": any public event (D39). A scheduled
// event at any time its row exists, a manual round once it has a snapshot (D28), never a rehearsal. The
// name is plain text, 1–80 characters, no control characters. PIN only. The path keeps its D28 name.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { manualName } from "@/lib/manual-event-schema";
import { renameEvent } from "@/lib/repo/events";
import { errorResponse, withContext } from "@/lib/route";

const body = z
  .object({
    event_id: z.number().int().positive(),
    name: manualName,
  })
  .strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/manual-event/rename", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const result = await renameEvent(db, parsed.data.event_id, parsed.data.name);
    if (result === "not-found") return errorResponse(404, "event_not_found");
    if (result === "no-snapshot") return errorResponse(409, "rename_before_run");
    return Response.json({ event_id: parsed.data.event_id, name: parsed.data.name });
  });
}
