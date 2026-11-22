// POST /api/w/[slug]/features — Alliance settings → Features (D134, issue 476). Officers only: same origin,
// JSON, an officer's session (a member's answers 401 signed_out, D99). {feature, on}: the alliance turns an
// allowed feature on or off; the answer is `{ok, on}`, the switch as stored. 403 not_allowed: the site's owner does not allow it; 429 rate_limited. Each
// switch that went through counts as `ws_action` `features` / `turn_on` or `turn_off`.
import { requireWorkspace } from "@/lib/private/access";
import { allianceFeatureInput, setAllianceFeature } from "@/lib/private/alliance-features";
import { withActionEvent } from "@/lib/private/desk-action";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS = { rate_limited: 429, not_allowed: 403 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = allianceFeatureInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/features", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const done = await setAllianceFeature(db, access, input, {
      env: ctx.env,
      fetch: ctx.fetch,
      now,
    });
    if (!done.ok) return privateError(STATUS[done.code], done.code);
    // D141: the squads targets may have changed, so the ticks look at the queue again.
    ctx.wakeCache.forget();
    const body = Response.json({ ok: true, on: done.on }, { headers: NO_STORE });
    return withActionEvent(ctx, access, "features", input.on ? "turn_on" : "turn_off", body);
  });
}
