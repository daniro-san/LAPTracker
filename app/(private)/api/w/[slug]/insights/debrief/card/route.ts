// GET /api/w/[slug]/insights/debrief/card — Insights → KvK → Debrief's card (issue 872): the debrief as one
// PNG to save and post in the leaders' channel, in the officer's desk language. Officers only (a member's
// session, another workspace's or none answers 401 signed_out); 403 turned_off with Insights off (D126); 404
// with no debrief (none in the last 4 weeks, or an Origin of Chaos week). Never cached; 0 upstream calls.
import { flagsOf } from "@/lib/flags";
import { requireWorkspace } from "@/lib/private/access";
import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import { pickWorkspaceLanguage, WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { featureOn } from "@/lib/private/features";
import { NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { kvkDebriefView } from "@/lib/private/kvk-debrief";
import { debriefCard, renderDebriefCard } from "@/lib/private/kvk-debrief-card";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  return withContext("/api/w/[slug]/insights/debrief/card", slug, async (ctx, db) => {
    const now = ctx.now();
    const cookies = requestCookies(request);
    const access = await requireWorkspace(db, slug, cookies, now);
    if (!access.ok) return privateError(401, "signed_out");
    if (!featureOn(access, "insights")) return privateError(403, "turned_off");
    const matchup = (await flagsOf(ctx.env, ctx.fetch)).has("kvk-matchup");
    const debrief = await kvkDebriefView(db, access, now, ctx.env.SERVER_TZ, matchup);
    if (!debrief) return privateError(404, "not_found");
    const language = pickWorkspaceLanguage(
      cookies.get(WORKSPACE_LANG_COOKIE)?.value,
      request.headers.get("accept-language"),
    );
    const png = await renderDebriefCard(
      debriefCard(debrief, { t: WORKSPACE_DICTIONARIES[language], language }),
    );
    return new Response(png, {
      headers: {
        ...NO_STORE,
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="kvk-debrief-${debrief.day}.png"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
