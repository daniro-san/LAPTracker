// POST /api/w/[slug]/kvk-castle — Insights → KvK's map (issue 791): the castle point officers type in, or
// both null to clear it. Officers only: same origin, JSON, an officer's session (401 signed_out, D99; a
// member's session too, D105). A square outside 0–999 is 400 bad_request; 429 rate_limited. The point is
// never logged, and no analytics event carries it.
import { requireWorkspace } from "@/lib/private/access";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { castleInput, saveCastlePoint } from "@/lib/private/kvk-map";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = castleInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/kvk-castle", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const done = await privately("kvk_castle.save", () => saveCastlePoint(db, access, input, now));
    if (!done.ok) return privateError(429, done.code);
    return Response.json({ ok: true }, { headers: NO_STORE });
  });
}
