// POST /api/w/[slug]/notices/picture?id=N — adds or replaces a notice's one picture (D119). The body is the
// picture itself, already resized and re-encoded in the browser; the server checks it again (magic bytes, at
// most 400 KB, at most 1600 px a side, not animated) and never trusts the request's content type. Same
// origin, a picture content type, a valid officer session (401 signed_out, D99). The body is read only with
// a Content-Length at most 400 KB (411 without one, 413 over it). One row per notice, so a retry with the
// same bytes writes nothing (D100) and is not counted again. Answers the picture's address and size; a
// notice in the trash answers 410 notice_deleted (D118).
import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
import { featureOn } from "@/lib/private/features";
import {
  isSameOriginPicture,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { savePicture } from "@/lib/private/notice-picture";
import { MAX_PICTURE_BYTES } from "@/lib/private/notice-picture-rules";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS = {
  empty: 400,
  too_large: 413,
  wrong_type: 415,
  too_big_sides: 422,
  animated: 422,
  not_found: 404,
  notice_deleted: 410,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  const raw = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[1-9]\d{0,8}$/.test(raw)) return privateError(400, "bad_request");
  if (!isSameOriginPicture(request)) return privateError(403, "forbidden");
  // The body is never read without a size it promises, and never past the cap (review of PR 422).
  const length = request.headers.get("content-length");
  if (length === null) return privateError(411, "length_required");
  if (!/^\d+$/.test(length) || Number(length) > MAX_PICTURE_BYTES) {
    return privateError(413, "too_large");
  }
  return withContext("/api/w/[slug]/notices/picture", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    if (!featureOn(access, "notice_pictures")) return privateError(403, "turned_off");
    const bytes = new Uint8Array(await request.arrayBuffer());
    const result = await privately("notices.picture", () =>
      savePicture(db, access, Number(raw), bytes, now),
    );
    if (!result.ok) return privateError(STATUS[result.code], result.code);
    const saved = Response.json(result.picture, { headers: NO_STORE });
    return result.changed ? counted(ctx, access, "notice", "picture_add", saved) : saved;
  });
}
