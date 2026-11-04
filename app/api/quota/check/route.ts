// GET /api/quota/check — the Friday check on demand (plan §3.1, §3.4): one quota call; posts to the
// admin webhook when remaining < 900. Spends quota, so it is authenticated like /api/snapshot.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { errorResponse, parseQuery, withContext } from "@/lib/route";
import { quotaReport } from "@/lib/run";

const noQuery = z.object({}).strict();

export function GET(request: Request): Promise<Response> {
  return withContext("/api/quota/check", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: true, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    return Response.json(await quotaReport(ctx, db, { always: false }));
  });
}
