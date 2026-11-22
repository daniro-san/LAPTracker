// POST /api/w/[slug]/callouts — Alliance settings → Your line on our posts (#713, D155). Officers only: same
// origin, JSON, an officer's session (401 signed_out, D99). {post, callout}: one post's line, at most 120
// graphemes once cleaned (400 too_long); "" clears it. 403 turned_off while `post_callouts` is off (D134);
// 429 rate_limited. A save that changed the line counts as `ws_action` `post_callout` / `save`; the text
// itself never leaves in a log or an event.
import { requireWorkspace } from "@/lib/private/access";
import { withActionEvent } from "@/lib/private/desk-action";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { calloutInput, saveCalloutFor } from "@/lib/private/post-callouts";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS = { turned_off: 403, too_long: 400, rate_limited: 429 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = calloutInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/callouts", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const done = await privately("callouts.save", () => saveCalloutFor(db, access, input, now));
    if (!done.ok) return privateError(STATUS[done.code], done.code);
    const body = Response.json({ post: input.post, callout: done.callout }, { headers: NO_STORE });
    return done.changed ? withActionEvent(ctx, access, "post_callout", "save", body) : body;
  });
}
