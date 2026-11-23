// GET /admin/feedback/picture/[id]: a feedback send's one picture (D157 amended 2026-11-22), for the owner's
// /admin/feedback only. The PIN session first, before any database read; without it (an officer's or a
// member's workspace session included), a missing picture or a purged row, the same 404, so a refusal says
// nothing. Never public: `private, no-cache` with an ETag (the bytes' hash), as /img/notice/[id] (D119); a
// matching If-None-Match answers 304 before the bytes are read.
import { isAdmin } from "@/lib/admin-session";
import { feedbackPicture, feedbackPictureBytes } from "@/lib/queries/admin-feedback";
import { withContext } from "@/lib/route";

const gone = () =>
  new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!/^[1-9]\d{0,8}$/.test(id) || !(await isAdmin())) return gone();
  return withContext("/admin/feedback/picture/[id]", async (_ctx, db) => {
    const picture = await feedbackPicture(db, Number(id));
    if (!picture) return gone();
    const etag = `"${picture.hash}"`;
    const headers = {
      "Cache-Control": "private, no-cache",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
    };
    // An unchanged picture answers 304 without its bytes ever being read from Neon.
    if (request.headers.get("if-none-match") === etag)
      return new Response(null, { status: 304, headers });
    const data = await feedbackPictureBytes(db, Number(id));
    if (!data) return gone();
    return new Response(new Uint8Array(data), {
      headers: {
        ...headers,
        "Content-Type": picture.type,
        "Content-Length": String(data.length),
      },
    });
  });
}
