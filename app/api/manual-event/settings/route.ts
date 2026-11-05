// POST /api/manual-event/settings {event_id, visibility?, post_public?} — /admin's visibility and
// Discord controls for a manual round (D28), editable at any time. "admin" with a public post is
// refused. PIN only.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { setManualSettings } from "@/lib/repo/events";
import { errorResponse, withContext } from "@/lib/route";

const body = z
  .object({
    event_id: z.number().int().positive(),
    visibility: z.enum(["admin", "standalone", "history"]).optional(),
    post_public: z.boolean().optional(),
  })
  .strict()
  .refine((b) => b.visibility !== undefined || b.post_public !== undefined);

export function POST(request: Request): Promise<Response> {
  return withContext("/api/manual-event/settings", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const { event_id: id, visibility, post_public: postPublic } = parsed.data;
    const result = await setManualSettings(db, id, {
      ...(visibility !== undefined && { visibility }),
      ...(postPublic !== undefined && { postPublic }),
    });
    if (result === "not-found") return errorResponse(404, "event_not_found");
    if (result === "admin-cannot-post") return errorResponse(409, "admin_cannot_post");
    return Response.json({ event_id: id });
  });
}
