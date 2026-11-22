// POST /api/admin/feedback — /admin/feedback's status on one item (D157): {id, status} with status new, read,
// issue ("Became an issue") or dropped. PIN only, with the PIN's rate limits; 404 when no such item.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { FEEDBACK_STATUSES } from "@/lib/feedback-words";
import { setFeedbackStatus } from "@/lib/repo/feedback";
import { errorResponse, withContext } from "@/lib/route";

const body = z
  .object({ id: z.number().int().positive().max(2_147_483_647), status: z.enum(FEEDBACK_STATUSES) })
  .strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/admin/feedback", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    if (!(await setFeedbackStatus(db, parsed.data.id, parsed.data.status)))
      return errorResponse(404, "not_found");
    return Response.json({ ok: true });
  });
}
