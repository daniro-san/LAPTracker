// POST /api/admin/squads-read — /admin's "Run the squads read now" (D117, amendment 2026-11-19b; D132):
// the next batches of the day's squads queue now, without waiting for the next tick, for one workspace
// (`?union=`) or all, started after the answer on the tick's path (squadsBatch → runSquadsBatch with
// `force`), one batch after another while members' turns have come and another whole batch fits in
// maxDuration. The same queue, claim, per-call save, 120-call cap, reserve and keys (D124) as the tick's,
// so a press and the ticks never read a member twice in a quota day. Refused during the scheduled event's
// Before/After window and when a batch would cross the 00:00 UTC quota reset. PIN only, with the PIN's
// rate limiter. The answer names the workspaces whose batches start; /admin shows their progress.
import { after } from "next/server";
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { getDailyRead } from "@/lib/repo/daily-reads";
import { errorResponse, parseQuery, withContext } from "@/lib/route";
import { forcedSquadsDay } from "@/lib/squads";
import { squadsBatch } from "@/lib/squads-tick";
import { squadTargets } from "@/lib/workspace-keys";

export const maxDuration = 300;

const ROUTE = "/api/admin/squads-read";
/** A further batch starts only when it ends by 240 s: 60 s of maxDuration stay for the answer and writes. */
const BATCHES_MS = 240_000;

const query = z
  .object({
    union: z
      .string()
      .regex(/^\d{1,15}$/)
      .transform(Number)
      .optional(),
  })
  .strict();

export function POST(request: Request): Promise<Response> {
  return withContext(ROUTE, async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const q = parseQuery(request, query);
    if (!q) return errorResponse(400, "bad_request");
    const now = ctx.now();
    const forced = forcedSquadsDay(now, ctx.env);
    if ("refused" in forced) return errorResponse(409, forced.refused);
    const daily = await getDailyRead(db, forced.day);
    if (!daily || daily.status === "running") return errorResponse(409, "daily_read_pending");
    const targets = (await squadTargets(db, ctx.env.WORKSPACE_KEYS_SECRET, now)).filter(
      (t) => q.union === undefined || t.unionId === q.union,
    );
    if (targets.length === 0) return errorResponse(409, "no_target");
    const run = { force: true, ...(q.union !== undefined && { unionId: q.union }) };
    after(() => squadsBatch(ctx, { run, route: ROUTE, budgetMs: BATCHES_MS }));
    return Response.json(
      { day: forced.day, workspaces: targets.map((t) => t.slug) },
      { status: 202 },
    );
  });
}
