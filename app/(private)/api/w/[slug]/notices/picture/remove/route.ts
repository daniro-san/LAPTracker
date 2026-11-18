// POST /api/w/[slug]/notices/picture/remove {id} — removes a notice's picture (D119). A write: same origin,
// JSON, a valid officer session (401 signed_out, D99). Removing a picture that is already gone answers ok, so
// a retry after a lost answer does no harm.
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
  return withContext("/api/w/[slug]/notices/picture/remove", async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    await removePicture(db, access, parsed.data.id);
    const removed = Response.json({ ok: true }, { headers: NO_STORE });
    return counted(ctx, access, "notice", "delete", removed);
  });
}
