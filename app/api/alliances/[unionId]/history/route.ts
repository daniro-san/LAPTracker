// GET /api/alliances/[unionId]/history?at=<ISO time> — one member history card's contents (D60): the roster
// read at `at`, diffed against the previous usable one. The page loads a closed card's contents with it
// when the card is opened. Read model only: uid, name, power, kills (plan §12.1).
import { z } from "zod";

import { memberHistoryCard } from "@/lib/queries";
import { errorResponse, parseQuery, withContext } from "@/lib/route";

const unionId = z
  .string()
  .regex(/^\d{1,15}$/)
  .transform(Number);
const query = z.object({ at: z.iso.datetime().transform((s) => new Date(s)) }).strict();

export function GET(
  request: Request,
  { params }: { params: Promise<{ unionId: string }> },
): Promise<Response> {
  return withContext("/api/alliances/[unionId]/history", async (_ctx, db) => {
    const id = unionId.safeParse((await params).unionId);
    const q = parseQuery(request, query);
    if (!id.success || !q) return errorResponse(400, "bad_request");
    const body = await memberHistoryCard(db, id.data, q.at);
    if (!body) return errorResponse(404, "not_found");
    // A past roster does not change; only "now in" can, so a short shared cache is enough.
    return Response.json(body, { headers: { "Cache-Control": "public, s-maxage=300" } });
  });
}
