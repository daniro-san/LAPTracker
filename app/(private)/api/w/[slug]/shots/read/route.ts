// POST /api/w/[slug]/shots/read — one picture from the desk's "Send screenshots" (issue 299): the browser
// sends it as PNG, without the phone's status bar and scaled down; the OCR reads it and its text lines come
// back. The picture is read in memory and not kept. Officers of the workspace only (D71).
import { requireWorkspace } from "@/lib/private/access";
import { isSameOriginPicture, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { readUpload } from "@/lib/private/import-read";
import { privateLog } from "@/lib/private/log";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

/** The OCR's worker start and one page: seconds, more under load (D74). */
export const maxDuration = 60;
/** Under Vercel's 4.5 MB request body limit; the browser sends about 0.5-1.5 MB. */
const MAX_UPLOAD = 4 * 1024 * 1024;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginPicture(request)) return privateError(403, "forbidden");
  if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD) {
    return privateError(413, "too_large");
  }
  return withContext("/api/w/[slug]/shots/read", async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, access.reason);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_UPLOAD) return privateError(413, "too_large");
    const lines = await readUpload(bytes);
    if (!lines) return privateError(422, "refused");
    privateLog("w.import.read", { workspace: access.workspaceId, lines: lines.length });
    return Response.json({ lines }, { headers: NO_STORE });
  });
}
