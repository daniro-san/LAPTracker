// POST /api/admin/workspaces/allowlist {workspace_id, discord_user_id, expires_on} — puts a Discord
// account on a workspace's allowlist until the end of `expires_on` (UTC), or moves that date (D71). PIN only.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { allowUser } from "@/lib/repo/workspaces";
import { errorResponse, withContext } from "@/lib/route";

const body = z
  .object({
    workspace_id: z.number().int().positive(),
    discord_user_id: z.string().regex(/^\d{17,20}$/),
    expires_on: z.iso.date(),
  })
  .strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/admin/workspaces/allowlist", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const expiresAt = new Date(`${parsed.data.expires_on}T23:59:59.999Z`);
    if (expiresAt.getTime() <= ctx.now().getTime()) return errorResponse(400, "expiry_past");
    const { workspace_id, discord_user_id } = parsed.data;
    const result = await allowUser(db, workspace_id, discord_user_id, expiresAt, "admin");
    if (result === "not_found") return errorResponse(404, "workspace_not_found");
    return Response.json({ ok: true });
  });
}
