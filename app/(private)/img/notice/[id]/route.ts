// GET /img/notice/[id]: a notice's picture (D119), only after the notice's own access check: an officer of
// its workspace, or a member while the members' board shows the notice (D105). Anything else, a missing
// picture or a removed notice is a 404, so a refusal says nothing. Never public: `private, no-cache` with an
// ETag (the bytes' hash), so every view checks access again and an unchanged picture answers 304. The
// `?v=` in the address only changes the URL when the picture is replaced.
import { requestCookies } from "@/lib/private/http";
import { servablePicture, servedBytes } from "@/lib/private/notice-picture";
import { withContext } from "@/lib/route";
import { serverDay } from "@/lib/schedule";

const CACHE = "private, no-cache";
const gone = () =>
  new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  if (!/^[1-9]\d{0,8}$/.test(id)) return gone();
  return withContext("/img/notice/[id]", async (ctx, db) => {
    const now = ctx.now();
    const cookies = requestCookies(request);
    const picture = await servablePicture(db, Number(id), cookies, now, serverDay(now, ctx.env));
    if (!picture) return gone();
    const etag = `"${picture.hash}"`;
    const headers = { "Cache-Control": CACHE, ETag: etag, "X-Content-Type-Options": "nosniff" };
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers });
    }
    const bytes = await servedBytes(db, picture);
    if (!bytes) return gone();
    return new Response(new Uint8Array(bytes.data), {
      headers: {
        ...headers,
        "Content-Type": bytes.type,
        "Content-Length": String(bytes.data.length),
      },
    });
  });
}
