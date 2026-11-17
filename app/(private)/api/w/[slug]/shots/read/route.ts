// POST /api/w/[slug]/shots/read — one picture from the desk's "Send screenshots" (issue 299): the browser
// sends it as PNG, without the phone's status bar and scaled down; the OCR reads it and its text lines come
// back. The picture is read in memory and not kept. Officers of the workspace only (D71). Also "Read from a
// screenshot" beside the facts' paste boxes (D109): one read at a time per officer, else 429 `busy`.
import { requireWorkspace } from "@/lib/private/access";
import {
  isSameOriginPicture,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { MAX_UPLOAD } from "@/lib/private/import";
import { endReading, failureCode, readUpload, startReading } from "@/lib/private/import-read";
import { privateLog } from "@/lib/private/log";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

/** The OCR's worker start and one page: seconds, more under load (D74). */
export const maxDuration = 60;

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
    if (!access.ok) return privateError(401, "signed_out");
    const officer = access.user.id;
    // One reading at a time per officer, shared with the phone's share (D109, D110).
    if (!startReading(officer)) return privateError(429, "busy");
    let lines: string[] | null;
    try {
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_UPLOAD) return privateError(413, "too_large");
      // A worker that dies or stalls fails the request with a code (500 "internal"), never a timeout;
      // app_errors keeps the code only, e.g. w.import.read_failed:reader:MODULE_NOT_FOUND.
      lines = await privately(
        (error) => failureCode("w.import.read_failed", error),
        () => readUpload(bytes),
      );
    } finally {
      endReading(officer);
    }
    if (!lines) return privateError(422, "refused");
    privateLog("w.import.read", { workspace: access.workspaceId, lines: lines.length });
    return Response.json({ lines }, { headers: NO_STORE });
  });
}
