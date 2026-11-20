// POST /api/admin/invites — /admin's New alliances card (D130, issue 453). PIN only; the actions are in
// lib/admin-invites.ts. "create" and "approve" answer the link once ({link, expires_at}).
import { adminInviteAction, adminInviteInput } from "@/lib/admin-invites";
import { authorize } from "@/lib/auth";
import { errorResponse, withContext } from "@/lib/route";

export function POST(request: Request): Promise<Response> {
  return withContext("/api/admin/invites", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = adminInviteInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const origin = new URL(request.url).origin;
    const result = await adminInviteAction(db, parsed.data, ctx.now(), origin);
    if (!result.ok) return errorResponse(result.status, result.code);
    if (!result.link) return Response.json({ ok: true });
    return Response.json({ link: result.link, expires_at: result.expiresAt?.toISOString() });
  });
}
