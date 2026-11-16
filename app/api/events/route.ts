// GET /api/events — every event with its snapshots' status (read model only, plan §12.1;
// no isTest: the public pages do not show it).
import { z } from "zod";

import { listEvents } from "@/lib/queries";
import { errorResponse, parseQuery, withContext } from "@/lib/route";

const noQuery = z.object({}).strict();

export function GET(request: Request): Promise<Response> {
  return withContext("/api/events", async (_ctx, db) => {
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    const events = (await listEvents(db)).map(({ isTest: _, ...e }) => e);
    // Same short shared cache as /api/alliances/[unionId]/history: a visibility switch or rename
    // reaches the CDN copy within 5 minutes.
    return Response.json({ events }, { headers: { "Cache-Control": "public, s-maxage=300" } });
  });
}
