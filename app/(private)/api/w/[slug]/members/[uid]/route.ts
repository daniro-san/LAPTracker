// GET /api/w/[slug]/members/[uid] — one member's details for the Members list's sheet (issue 337): the
// card's words in the officer's language, read when the sheet opens, so the map position and last online
// time stay out of the list's page (D71). A session of this workspace; 404 when the uid is not in the
// workspace's own alliance. private, no-store; nothing is logged.
import { requireWorkspace } from "@/lib/private/access";
import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import { pickWorkspaceLanguage, WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { NO_STORE, privateError, privately, requestCookies } from "@/lib/private/http";
import { memberCard } from "@/lib/private/member-card";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const UID = /^[1-9]\d{0,15}$/;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; uid: string }> },
): Promise<Response> {
  const { slug, uid } = await params;
  if (!SLUG.test(slug) || !UID.test(uid)) return privateError(404, "not_found");
  const jar = requestCookies(request);
  const language = pickWorkspaceLanguage(
    jar.get(WORKSPACE_LANG_COOKIE)?.value,
    request.headers.get("accept-language"),
  );
  return withContext("/api/w/[slug]/members/[uid]", async (ctx, db) => {
    const access = await requireWorkspace(db, slug, jar, ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    const card = await privately("members.card", () =>
      memberCard(db, access, Number(uid), {
        now: ctx.now(),
        zone: ctx.env.SERVER_TZ,
        language,
        t: WORKSPACE_DICTIONARIES[language],
      }),
    );
    if (!card) return privateError(404, "not_member");
    return Response.json({ card }, { headers: NO_STORE });
  });
}
