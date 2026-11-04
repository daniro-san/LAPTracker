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
    return event ? Response.json({ event }) : errorResponse(404, "not_found");
  });
}
