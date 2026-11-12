// POST /api/admin/session — the /admin PIN gate (plan Phase 4): a right PIN in x-edit-pin sets the
// session cookie that unlocks the admin pages. Same limiter as every PIN route.
// The cookie lasts SESSION_MS (7 days); the server checks its signed issue time as well.
// DELETE /api/admin/session — ends the session: the cookie expires now. No PIN: it only clears this
// browser's own cookie. "Log out" calls it, and the PIN card when the PIN changed or the session expired.
import { z } from "zod";

import { ADMIN_COOKIE, adminToken, SESSION_MS } from "@/lib/admin-session";
import { authorize } from "@/lib/auth";
import { errorResponse, parseQuery, withContext } from "@/lib/route";

const noQuery = z.object({}).strict();
const ATTRIBUTES = `Path=/; HttpOnly; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

export function POST(request: Request): Promise<Response> {
  return withContext("/api/admin/session", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    const maxAge = SESSION_MS / 1000;
    const cookie = `${ADMIN_COOKIE}=${adminToken(ctx.env, ctx.now())}; Max-Age=${maxAge}; ${ATTRIBUTES}`;
    return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
  });
}

export function DELETE(request: Request): Response {
  if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
  const cookie = `${ADMIN_COOKIE}=; Max-Age=0; ${ATTRIBUTES}`;
  return new Response(null, { status: 204, headers: { "Set-Cookie": cookie } });
}
