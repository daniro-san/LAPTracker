// POST /api/admin/session — the /admin PIN gate (plan Phase 4): a right PIN in x-edit-pin sets the
// session cookie that unlocks the admin pages. Same limiter as every PIN route.
import { z } from "zod";

import { ADMIN_COOKIE, adminToken } from "@/lib/admin-session";
import { authorize } from "@/lib/auth";
import { errorResponse, parseQuery, withContext } from "@/lib/route";

const noQuery = z.object({}).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/admin/session", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    const cookie = `${ADMIN_COOKIE}=${adminToken(ctx.env)}; Path=/; HttpOnly; SameSite=Strict${secure}`;
    return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
  });
}
