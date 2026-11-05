// POST /api/manual-event/rename {event_id, name} — /admin's "Rename" (D28): only a manual event that
// already has a snapshot. The name is plain text, 1–80 characters, no control characters. PIN only.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { renameManualEvent } from "@/lib/repo/events";
import { errorResponse, withContext } from "@/lib/route";

const body = z
  .object({
    event_id: z.number().int().positive(),
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[^\p{Cc}]+$/u),
  })
  .strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/manual-event/rename", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const result = await renameManualEvent(db, parsed.data.event_id, parsed.data.name);
    if (result === "not-found") return errorResponse(404, "event_not_found");
    if (result === "no-snapshot") return errorResponse(409, "rename_before_run");
    return Response.json({ event_id: parsed.data.event_id, name: parsed.data.name });
  });
}
