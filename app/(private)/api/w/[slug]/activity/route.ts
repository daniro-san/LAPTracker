// GET /api/w/[slug]/activity?before=<ms> — the next page of Home's "Recent activity" (D108, 2026-11-18):
// the lines older than the cursor Home or the previous page gave, made in the officer's language. An
// officer's session of this workspace; 401 `signed_out` without one (D99). private, no-store; nothing is
// logged.
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import { activityPage, ACTIVITY_PAGE } from "@/lib/private/desk-activity";
import { activityView } from "@/lib/private/desk-activity-words";
import { pickWorkspaceLanguage, WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { NO_STORE, privateError, privately, requestCookies } from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { parseQuery, withContext } from "@/lib/route";

/**
 * The cursor in ms, at most the end of year 9999: a later Date writes a six-digit year Postgres cannot
 * read, so a larger cursor is a 400, never an error.
 */
const LAST_MS = Date.UTC(9999, 11, 31, 23, 59, 59, 999);
const query = z.object({ before: z.coerce.number().int().positive().max(LAST_MS) }).strict();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  const asked = parseQuery(request, query);
  if (!asked) return privateError(400, "bad_request");
  const jar = requestCookies(request);
  const language = pickWorkspaceLanguage(
    jar.get(WORKSPACE_LANG_COOKIE)?.value,
    request.headers.get("accept-language"),
  );
  return withContext("/api/w/[slug]/activity", async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, jar, now);
    if (!access.ok) return privateError(401, "signed_out");
    const page = await privately("activity.page", () =>
      activityPage(
        db,
        access,
        { now, zone: ctx.env.SERVER_TZ },
        new Date(asked.before),
        ACTIVITY_PAGE,
      ),
    );
    const view = activityView(page, WORKSPACE_DICTIONARIES[language], language, now);
    return Response.json(view, { headers: NO_STORE });
  });
}
