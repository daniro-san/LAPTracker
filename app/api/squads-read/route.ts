// POST /api/squads-read — the next batch of the nightly squads read (D117). The backup path: /api/tick
// starts the batches itself (amendment 2026-11-19); tick.yml calls this after its own runs, and it can be
// called by hand. 204 when nothing is due; the claim keeps it from overlapping the tick's batch. Bearer
// CRON_SECRET only.
import { z } from "zod";

import { secretsOf } from "@/lib/app-context";
import { authorize } from "@/lib/auth";
import { errorResponse, parseQuery, withContext } from "@/lib/route";
import { runSquadsBatch } from "@/lib/squads-read";

export const maxDuration = 120;

const noQuery = z.object({}).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/squads-read", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: true, pin: false });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    const deps = {
      v1: ctx.v1,
      now: ctx.now,
      fetch: ctx.fetch,
      env: ctx.env,
      secrets: secretsOf(ctx.env),
    };
    const outcome = await runSquadsBatch(deps, db);
    if (outcome.kind === "idle") return new Response(null, { status: 204 });
    return Response.json({
      action: "squads-read",
      day: outcome.day,
      status: outcome.status,
      calls: outcome.calls,
      more: outcome.more,
    });
  });
}
