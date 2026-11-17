// POST /api/admin/workspaces/sign-out {workspace_id, scope, user_id?} — /admin's "Sign out users" (D71,
// D105 amended 2026-11-17): ends that workspace's sessions, everyone's, the officers', the members', or one
// person's. Sessions only: nobody is blocked, and whoever still belongs signs in with Discord again. The
// owner's own /admin access is the PIN, not a workspace session. PIN only, with the PIN's rate limits.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { signOutWorkspace } from "@/lib/repo/workspaces";
import { errorResponse, withContext } from "@/lib/route";

const id = z.number().int().positive();
const body = z.discriminatedUnion("scope", [
  z.object({ workspace_id: id, scope: z.enum(["all", "officers", "members"]) }).strict(),
  z.object({ workspace_id: id, scope: z.literal("user"), user_id: id }).strict(),
]);

export function POST(request: Request): Promise<Response> {
  return withContext("/api/admin/workspaces/sign-out", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const b = parsed.data;
    const who = b.scope === "user" ? { scope: b.scope, userId: b.user_id } : { scope: b.scope };
    const ended = await signOutWorkspace(db, b.workspace_id, who);
    // One person with no session in this workspace (another workspace's user, or already signed out).
    if (b.scope === "user" && ended === 0) return errorResponse(404, "no_session");
    return Response.json({ ended });
  });
}
