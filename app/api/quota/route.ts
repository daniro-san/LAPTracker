// GET /api/quota — the /v1 quota as numbers (plan §12.2: never the key). Each request spends one
// quota call, so it takes the same auth and rate limit as /api/snapshot, and the UI warns first.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { errorResponse, parseQuery, withContext } from "@/lib/route";

const noQuery = z.object({}).strict();

export function GET(request: Request): Promise<Response> {
  return withContext("/api/quota", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { allowPin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    const quota = await ctx.v1.fetchQuota().catch(() => null);
    if (!quota) return errorResponse(502, "upstream_error");
    return Response.json({ limit: quota.limit, used: quota.used, remaining: quota.remaining });
  });
}
