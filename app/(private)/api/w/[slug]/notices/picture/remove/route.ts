// POST /api/w/[slug]/notices/picture/remove {id} — removes a notice's picture (D119). A write: same origin,
// JSON, a valid officer session (401 signed_out, D99). Removing a picture that is already gone answers ok, so
// a retry after a lost answer does no harm. A notice in the trash answers 410 notice_deleted
// (D118), so the editor offers to restore it.
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { removePicture } from "@/lib/private/notice-picture";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const input = z.object({ id: z.number().int().positive() }).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/notices/picture/remove", slug, async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    const result = await removePicture(db, access, parsed.data.id);
    if (result === "notice_deleted") return privateError(410, "notice_deleted");
    const removed = Response.json({ ok: true }, { headers: NO_STORE });
    // Counted only when a picture was really removed (review of PR 422).
    return result === "removed"
      ? counted(ctx, access, "notice", "picture_remove", removed)
      : removed;
  });
}
