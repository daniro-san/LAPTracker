// POST /api/admin/workspaces/deletion {workspace_id, action: "ask" | "cancel"} — /admin's "Delete in 14
// days" and "Cancel the deletion" (D125). The same grace as an officer's: the workspace is deleted by the
// daily job 14 days later, and its officers see the banner and can cancel. PIN only, with its rate limits.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { askDeletion, cancelDeletion } from "@/lib/repo/workspace-purge";
import { errorResponse, withContext } from "@/lib/route";

const body = z
  .object({ workspace_id: z.number().int().positive(), action: z.enum(["ask", "cancel"]) })
  .strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/admin/workspaces/deletion", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const { workspace_id: id, action } = parsed.data;
    if (action === "cancel") {
      return Response.json({ cancelled: await cancelDeletion(db, id), purge_after: null });
    }
    const asked = await askDeletion(db, id, null, ctx.now());
    if (!asked) return errorResponse(404, "no_workspace");
    return Response.json({ purge_after: asked.purgeAfter.toISOString() });
  });
}
