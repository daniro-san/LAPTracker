// POST /api/tick — the scheduler's entry point (plan §3.1). cron-job.org calls it every 15 min, every day
// (D30; tick.yml is a second path); it does at most one thing per call and answers 204 when nothing is
// due. After its answer it also starts the next batch of the day's squads queue (D117, amendment
// 2026-11-19; D132: on every tick).
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { finishTick, startTick } from "@/lib/repo/ticks";
import { errorResponse, parseQuery, withContext } from "@/lib/route";
import { runResponse } from "@/lib/run-response";
import { scheduleSquadsBatch } from "@/lib/squads-tick";
import { runTick } from "@/lib/tick";

/**
 * The tick's own work (at most RUN_DEADLINE_MS, 100 s, plus its writes) and, after the answer, a squads
 * batch (SQUADS_BATCH_MS, 60 s, at most, D132) share one function run: 300 s, the Vercel Hobby maximum
 * with Fluid compute.
 */
export const maxDuration = 300;

const noQuery = z.object({}).strict();

export function POST(request: Request): Promise<Response> {
  return withContext("/api/tick", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: true, pin: false });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    // INVARIANT tick.heartbeat-after-auth: a 401 is not a heartbeat (D45); the row goes in before
    // the work, so a killed function still leaves one, with no finished_at.
    const heartbeat = await startTick(db, ctx.now());
    const origin = new URL(request.url).origin;
    const tick = await runTick(ctx, db, origin);
    await finishTick(db, heartbeat, ctx.now(), tick.kind);
    // After the answer, so cron-job.org's 30 s timeout never waits for it. The claim makes it safe beside
    // POST /api/squads-read (tick.yml, or by hand): one batch at a time per alliance.
    scheduleSquadsBatch(ctx, origin);
    switch (tick.kind) {
      case "idle":
        return new Response(null, { status: 204 });
      case "run":
      case "sample":
        return runResponse(tick.outcome);
      case "quota-check":
        return Response.json({
          action: "quota-check",
          event_id: tick.eventId,
          remaining: tick.remaining,
          pictures_pruned: tick.picturesPruned,
        });
      case "rehearsal":
        return Response.json({
          action: "rehearsal",
          slot_at: tick.slotAt,
          ...(tick.result.ok ? { event_id: tick.result.eventId } : { skipped: tick.result.reason }),
        });
      case "daily-read":
        return Response.json({
          action: "daily-read",
          day: tick.summary.day,
          status: tick.summary.status,
          calls_used: tick.summary.callsUsed,
        });
    }
  });
}
