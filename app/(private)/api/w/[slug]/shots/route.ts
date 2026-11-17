// POST /api/w/[slug]/shots {pictures: [{lines}], pick?} — "Send screenshots" (issue 299): the pictures'
// OCR text lines (from /shots/read) become drafts for every officer to review. Classified again here,
// so a map never becomes data. `pick` is the officer's type for pictures that were not recognised;
// `preset`, the type of the tab's button they were sent with (D110).
import { requireWorkspace } from "@/lib/private/access";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { createDrafts } from "@/lib/private/import";
import { createBody, screenOf } from "@/lib/private/import-input";
import { classified } from "@/lib/private/import-read";
import { privateLog } from "@/lib/private/log";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";
import { serverDay } from "@/lib/schedule";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const body = createBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/shots", async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const { pictures, pick, pasted, preset } = body.data;
    const sent = {
      // "Paste updates" lines (D109) make a draft whose review says "Pasted by".
      source: pasted ? ("pasted" as const) : ("desk" as const),
      sentBy: access.user.displayName,
      pictureDay: serverDay(now, ctx.env),
      now,
    };
    // The text read from a picture (names, chat lines) leaves an error as a code alone (D80).
    const result = await privately("shots_create", () =>
      createDrafts(
        db,
        access,
        classified(pictures.map((p) => p.lines)),
        sent,
        pick && screenOf(pick.kind, pick.scope),
        preset && screenOf(preset, null),
      ),
    );
    privateLog("w.import.desk", {
      workspace: access.workspaceId,
      pictures: pictures.length,
      drafts: result.drafts.length,
    });
    return Response.json(result, { headers: NO_STORE });
  });
}
