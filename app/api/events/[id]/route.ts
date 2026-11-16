// GET /api/events/[id] — one event, its snapshots and alliance rows (read model only, plan §12.1).
import { z } from "zod";

import { getEventDetail } from "@/lib/queries";
import { errorResponse, parseQuery, withContext } from "@/lib/route";

const noQuery = z.object({}).strict();
const eventId = z
  .string()
  .regex(/^\d{1,9}$/)
  .transform(Number);

export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  return withContext("/api/events/[id]", async (_ctx, db) => {
    const id = eventId.safeParse((await params).id);
    if (!id.success || !parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    const event = await getEventDetail(db, id.data);
    if (!event) return errorResponse(404, "not_found");
    // Only what the public pages show: no run bookkeeping (calls, quota, duration, error), no isTest,
    // and no board numbers or their source (lib/sources/internal.ts is a cross-check only, D5).
    const body = {
      ...(({ isTest: _, ...e }) => e)(event),
      snapshots: event.snapshots.map(
        ({
          callsUsed: _c,
          quotaRemainingAfter: _q,
          durationMs: _d,
          boardPulledAt: _b,
          error: _e,
          alliances,
          ...s
        }) => ({
          ...s,
          alliances: alliances.map(
            ({ powerBoard: _p, killsBoard: _k, source: _s, cached: _x, ...a }) => a,
          ),
        }),
      ),
    };
    // Same short shared cache as /api/alliances/[unionId]/history: a visibility switch or rename
    // reaches the CDN copy within 5 minutes. Errors keep the default headers.
    return Response.json({ event: body }, { headers: { "Cache-Control": "public, s-maxage=300" } });
  });
}
