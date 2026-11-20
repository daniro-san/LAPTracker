// GET /api/w/[slug]/read-status — the desk's read status bar (D135, issue 478): its lines in the officer's
// language, counts and server times only, and whether a read is under way. The bar asks every 30 s while a
// read runs and its tab is visible. An officer's session of this workspace; 401 `signed_out` without one
// (D99). private, no-store; nothing is logged; no tracker call.
import { requireWorkspace } from "@/lib/private/access";
import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import { pickWorkspaceLanguage, WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { NO_STORE, privateError, privately, requestCookies } from "@/lib/private/http";
import { readStatus } from "@/lib/private/read-status";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  const jar = requestCookies(request);
  const language = pickWorkspaceLanguage(
    jar.get(WORKSPACE_LANG_COOKIE)?.value,
    request.headers.get("accept-language"),
  );
  return withContext("/api/w/[slug]/read-status", slug, async (ctx, db) => {
    const now = ctx.now();
    // INVARIANT workspace.access-first: nothing private is read before this check.
    const access = await requireWorkspace(db, slug, jar, now);
    if (!access.ok) return privateError(401, "signed_out");
    const status = await privately("read-status.read", () =>
      readStatus(db, access, ctx.env, now, WORKSPACE_DICTIONARIES[language]),
    );
    return Response.json(status, { headers: NO_STORE });
  });
}
