// GET /api/events — every event with its snapshots' status (read model only, plan §12.1).
import { z } from "zod";

import { listEvents } from "@/lib/queries";
import { errorResponse, parseQuery, withContext } from "@/lib/route";

const noQuery = z.object({}).strict();

export function GET(request: Request): Promise<Response> {
  return withContext("/api/events", async (_ctx, db) => {
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    return Response.json({ events: await listEvents(db) });
  });
}
