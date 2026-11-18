// POST /api/w/[slug]/notices/picture?id=N — adds or replaces a notice's one picture (D119). The body is the
// picture itself, already resized and re-encoded in the browser; the server checks it again (magic bytes, at
// most 400 KB, at most 1600 px a side) and never trusts the request's content type. Same origin, a picture
// content type, a valid officer session (401 signed_out, D99). One row per notice, so a retry replaces the
// picture with the same bytes and stores nothing twice (D100). Answers the picture's address and size.
import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
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

const STATUS = { empty: 400, too_large: 413, wrong_type: 415, too_big_sides: 422, not_found: 404 };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  const raw = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[1-9]\d{0,8}$/.test(raw)) return privateError(400, "bad_request");
  if (!isSameOriginPicture(request)) return privateError(403, "forbidden");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_PICTURE_BYTES) {
    return privateError(413, "too_large");
  }
  return withContext("/api/w/[slug]/notices/picture", async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const bytes = new Uint8Array(await request.arrayBuffer());
    const result = await privately("notices.picture", () =>
      savePicture(db, access, Number(raw), bytes, now),
    );
    if (!result.ok) return privateError(STATUS[result.code], result.code);
    const saved = Response.json(result.picture, { headers: NO_STORE });
    return counted(ctx, access, "notice", "add", saved);
  });
}
