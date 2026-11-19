// POST /api/w/[slug]/notices/picture/reuse {from, to} — "Use in another notice" (D119): copies the picture of
// notice `from` to the live notice `to` of the same workspace, replacing any picture it had. The bytes are
// copied, so the copy has its own clock for the weekly cleanup. A write: same origin, JSON, an officer
// session (401 signed_out, D99). A retry copies the same picture once (one row per notice). 404 when either
// notice is missing, deleted (D118) or of another workspace, or `from` has no picture.
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { reusePicture } from "@/lib/private/notice-picture-due";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const input = z
  .object({ from: z.number().int().positive(), to: z.number().int().positive() })
  .strict()
  .refine((p) => p.from !== p.to);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/notices/picture/reuse", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const { from, to } = parsed.data;
    const result = await reusePicture(db, access, from, to, now);
    if (!result) return privateError(404, "not_found");
    const done = Response.json({ to }, { headers: NO_STORE });
    return result.changed ? counted(ctx, access, "notice", "picture_reuse", done) : done;
  });
}
