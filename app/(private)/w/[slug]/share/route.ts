// POST /w/[slug]/share — the desk app's share target (D110): screenshots shared from Android's gallery or the
// game to the installed Officers' Desk arrive here as a form (field `shots`), in a navigation. The address
// is inside the desk's manifest scope, as Android requires. An officer's pictures are read on the server, as
// the Discord command's are, and become drafts like "Send screenshots" makes; the answer is a 303 to the
// review (one draft) or to Home, which says what happened. Anyone else goes to the sign-in with "share
// again": the pictures are read in memory only and never kept, so nothing waits for the sign-in.
import { recordAppError } from "@/lib/app-errors";
import { requireWorkspace } from "@/lib/private/access";
import { useShotReads } from "@/lib/private/features";
import {
  isShareTarget,
  privateError,
  privately,
  redirectWith,
  requestCookies,
} from "@/lib/private/http";
import { createDrafts, MAX_PICTURES } from "@/lib/private/import";
import {
  classified,
  endReading,
  failureCode,
  MAX_UPLOAD,
  readUpload,
  startReading,
} from "@/lib/private/import-read";
import { privateLog } from "@/lib/private/log";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";
import { serverDay } from "@/lib/schedule";

/** The OCR's worker start and a few pages, about 0.5 s each (D74). */
export const maxDuration = 60;
/** Vercel's request body limit: a larger share is refused by Vercel before it gets here. */
const MAX_SHARE = 4.5 * 1024 * 1024;

const go = (location: string) => redirectWith(location, []);

/**
 * The shared pictures; "limit" past the limits (16 pictures, 4 MB each, 4.5 MB in all); "empty" when the
 * share holds no picture at all.
 */
async function sharedFiles(request: Request): Promise<File[] | "limit" | "empty"> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_SHARE) return "limit";
  const form = await request.formData().catch(() => null);
  const files = (form?.getAll("shots") ?? []).filter(
    (f): f is File => f instanceof File && f.size > 0 && f.type.startsWith("image/"),
  );
  if (files.length === 0) return "empty";
  const fits = files.every((f) => f.size <= MAX_UPLOAD);
  return files.length <= MAX_PICTURES && fits ? files : "limit";
}

/** Each picture's text lines, in memory for its reading only; a picture whose size is refused is left. */
async function readAll(files: File[]): Promise<string[][]> {
  const pages: string[][] = [];
  for (const file of files) {
    // A shared screenshot still has the phone's status bar.
    const lines = await readUpload(new Uint8Array(await file.arrayBuffer()), true);
    if (lines) pages.push(lines);
  }
  return pages;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  const home = `/w/${slug}`;
  // Headers other than a browser-made share or our own page: a page that says so, not a JSON code.
  if (!isShareTarget(request)) return go(`${home}?shared=failed`);
  return withContext("/w/[slug]/share", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    // Home shows the sign-in, sends a member to the board and an ended session through Discord.
    if (!access.ok) return go(`${home}?shared=again`);
    const files = await sharedFiles(request);
    if (typeof files === "string") return go(`${home}?shared=${files}`);
    // One reading at a time per officer, as "Read from a screenshot" and Send screenshots (D109).
    if (!startReading(access.user.id)) return go(`${home}?shared=busy`);
    try {
      // D162: the free plan's weekly screenshots, all the shared pictures at once; none is read if refused.
      if ((await useShotReads(db, access, files.length, now)) === "cap_reached")
        return go(`${home}?shared=cap`);
      const pages = await privately(
        (error) => failureCode("w.import.share_failed", error),
        () => readAll(files),
      );
      if (pages.length === 0) return go(`${home}?shared=empty`);
      const result = await privately("w.import.share_failed:drafts", () =>
        createDrafts(db, access, classified(pages), {
          source: "desk",
          sentBy: access.user.displayName,
          pictureDay: serverDay(now, ctx.env),
          now,
        }),
      );
      const made = result.drafts.length;
      const none = files.length - result.outcomes.filter((o) => o.status === "draft").length;
      const counts = { workspace: access.workspaceId, pictures: files.length, drafts: made };
      privateLog("w.import.share", counts);
      const [only] = result.drafts;
      if (only && made === 1 && none === 0) return go(`${home}/shots/${only.id}`);
      return go(`${home}?shared=done&made=${made}&none=${none}`);
    } catch (error) {
      // A code only (privately): app_errors gets it, as a /shots/read failure does.
      await recordAppError(ctx, {
        route: "/w/[slug]/share",
        kind: "route",
        digest: null,
        error,
        slug,
        handled: true,
      });
      return go(`${home}?shared=failed`);
    } finally {
      endReading(access.user.id);
    }
  });
}
