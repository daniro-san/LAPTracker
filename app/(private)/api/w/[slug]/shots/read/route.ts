// POST /api/w/[slug]/shots/read — one picture from the desk's "Send screenshots" (issue 299): the browser
// sends it as PNG, without the phone's status bar and scaled down; the OCR reads it and its text lines come
// back. The picture is read in memory and not kept. Officers of the workspace only (D71). Also "Read from a
// screenshot" beside the facts' paste boxes (D109): one read at a time per officer, else 429 `busy`.
// `?text=plain` reads the picture in plain grey only, for the garrison plan's enemy might (D121). D162: on
// the free plan each picture counts against the week's screenshots, else 429 `cap_reached`.
import { requireWorkspace } from "@/lib/private/access";
import { withActionEvent } from "@/lib/private/desk-action";
import { featureOn, useShotReads } from "@/lib/private/features";
import {
  isSameOriginPicture,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import {
  endReading,
  failureCode,
  MAX_UPLOAD,
  readUpload,
  startReading,
} from "@/lib/private/import-read";
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
  return withContext("/api/w/[slug]/shots/read", slug, async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    // D126: the switch turns off "Read from a screenshot" (`button=1`) only; "Send screenshots", the
    // phone's share and Secret Ops keep reading pictures.
    const params = new URL(request.url).searchParams;
    if (params.get("button") === "1" && !featureOn(access, "ocr"))
      return privateError(403, "turned_off");
    const officer = access.user.id;
    // One reading at a time per officer, shared with the phone's share (D109, D110).
    if (!startReading(officer)) return privateError(429, "busy");
    let lines: string[] | null;
    try {
      // D162: the free plan's weekly screenshots; a refused picture is not read.
      if ((await useShotReads(db, access, 1, ctx.now())) === "cap_reached")
        return privateError(429, "cap_reached");
      const bytes = new Uint8Array(await request.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_UPLOAD) return privateError(413, "too_large");
      // A worker that dies or stalls fails the request with a code (500 "internal"), never a timeout;
      // app_errors keeps the code only, e.g. w.import.read_failed:reader:MODULE_NOT_FOUND.
      lines = await privately(
        (error) => failureCode("w.import.read_failed", error),
        () => readUpload(bytes, false, params.get("text") === "plain"),
      );
    } finally {
      endReading(officer);
    }
    if (!lines) return privateError(422, "refused");
    privateLog("w.import.read", { workspace: access.workspaceId, lines: lines.length });
    return withActionEvent(
      ctx,
      access,
      "screenshot",
      "read_text",
      Response.json({ lines }, { headers: NO_STORE }),
    );
  });
}
