// POST /api/w/[slug]/notices/picture/keep {id, keep} — "Keep" a notice's picture so the weekly cleanup never
// deletes it, or stop keeping it (D119). Who and when are stored. A write: same origin, JSON, an officer
// session (401 signed_out, D99). Setting the same state twice is harmless. 404 when the notice has no picture.
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import { withActionEvent } from "@/lib/private/desk-action";
import { featureOn } from "@/lib/private/features";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { keepPicture } from "@/lib/private/notice-picture-due";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const input = z.object({ id: z.number().int().positive(), keep: z.boolean() }).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/notices/picture/keep", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    if (!featureOn(access, "notice_pictures")) return privateError(403, "turned_off");
    const { id, keep } = parsed.data;
    const result = await keepPicture(db, access, id, keep, now);
    if (!result) return privateError(404, "not_found");
    const done = Response.json({ kept: keep }, { headers: NO_STORE });
    if (!result.changed) return done;
    return withActionEvent(ctx, access, "notice", keep ? "picture_keep" : "picture_unkeep", done);
  });
}
