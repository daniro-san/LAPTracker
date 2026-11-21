// POST /api/alliances/[unionId]/details — "Get today's details" (D133, issue 459): one /v1 read of an alliance
// outside the daily read, at most once per alliance per server day for the whole site. No sign-in: same
// origin and a JSON body, and at most LOOKUP_IP_LIMIT presses per address in LOOKUP_IP_WINDOW_MS, counted
// before anything else. 200 {code: "done"}; 409 {code} when refused (taken, cap, quota, event_window, daily,
// failed); 404 for an alliance we do not know; 429 rate_limited.
import { z } from "zod";

import { clientIp } from "@/lib/auth";
import { databaseDown } from "@/lib/data-unavailable";
import { LOOKUP_IP_LIMIT, LOOKUP_IP_WINDOW_MS, lookupAlliance } from "@/lib/lookup";
import { recordFailure } from "@/lib/repo/auth-attempts";
import { errorResponse, isSameOriginJson, withContext } from "@/lib/route";

export const maxDuration = 30;

const unionId = z
  .string()
  .regex(/^\d{1,15}$/)
  .transform(Number);

export function POST(
  request: Request,
  { params }: { params: Promise<{ unionId: string }> },
): Promise<Response> {
  return withContext("/api/alliances/[unionId]/details", async (ctx, db) => {
    if (!isSameOriginJson(request)) return errorResponse(403, "forbidden");
    const id = unionId.safeParse((await params).unionId);
    if (!id.success) return errorResponse(400, "bad_request");
    // INVARIANT lookups.ip-rate-limit
    const key = `lookup:ip:${clientIp(request.headers)}`;
    if ((await recordFailure(db, key, LOOKUP_IP_WINDOW_MS, ctx.now())) > LOOKUP_IP_LIMIT)
      return errorResponse(429, "rate_limited");
    // INVARIANT cache.write-invalidates-reads (D143): the roster it stored is on the alliance's page at once
    // ("failed" too, and a throw: the roster may be stored when only the claim's close failed); not when
    // the database is down, when the kept pages are all the public site has.
    let code: Awaited<ReturnType<typeof lookupAlliance>>;
    try {
      code = await lookupAlliance(ctx, db, id.data);
    } catch (error) {
      if (!databaseDown(error)) ctx.publicCache.invalidate();
      throw error;
    }
    if (code === "done" || code === "failed") ctx.publicCache.invalidate();
    if (code === "unknown") return errorResponse(404, "not_found");
    return Response.json({ code }, { status: code === "done" ? 200 : 409 });
  });
}
