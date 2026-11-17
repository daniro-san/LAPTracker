// POST /api/admin/workspaces/sign-out-members {workspace_id} — "Sign out members" (D105): every member
// session of that workspace ends at once; officers stay signed in. PIN only, with the PIN's rate limits.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { signOutMembers } from "@/lib/repo/workspaces";
import { errorResponse, withContext } from "@/lib/route";

const body = z.object({ workspace_id: z.number().int().positive() }).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/admin/workspaces/sign-out-members", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const parsed = body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const ended = await signOutMembers(db, parsed.data.workspace_id);
    return Response.json({ ended });
  });
}
