// POST /api/manual-event — /admin's "Start a manual round" (D28): a public event with no schedule,
// run only by /admin's buttons through POST /api/snapshot?event=<id>. The optional JSON body
// {name?, visibility?, post_public?} sets the round's options at creation; without one the name is
// "Manual round <date>", the round is public on its own page and does not post to Discord. "admin" with
// a public post is refused, as in /settings. PIN only.
import { z } from "zod";

import { authorize } from "@/lib/auth";
import { manualName, manualVisibility } from "@/lib/manual-event-schema";
import { createManualEvent } from "@/lib/repo/events";
import { errorResponse, parseQuery, withContext } from "@/lib/route";

const noQuery = z.object({}).strict();
const body = z
  .object({
    name: manualName.optional(),
    visibility: manualVisibility.optional(),
    post_public: z.boolean().optional(),
  })
  .strict();

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export function POST(request: Request): Promise<Response> {
  return withContext("/api/manual-event", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    if (!parseQuery(request, noQuery)) return errorResponse(400, "bad_request");
    const text = (await request.text()).trim();
    const parsed = body.safeParse(text === "" ? {} : parseJson(text));
    if (!parsed.success) return errorResponse(400, "bad_request");
    const { name, visibility, post_public: postPublic } = parsed.data;
    if (visibility === "admin" && postPublic) return errorResponse(409, "admin_cannot_post");
    const now = ctx.now();
    const event = await createManualEvent(
      db,
      name ?? `Manual round ${now.toISOString().slice(0, 10)}`,
      now,
      {
        ...(visibility !== undefined && { visibility }),
        ...(postPublic !== undefined && { postPublic }),
      },
    );
    return Response.json({ event_id: event.id }, { status: 201 });
  });
}
