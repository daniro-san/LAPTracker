// POST /api/w/[slug]/posts — Alliance settings → Posts (#713 part C, D159). Officers only: same origin, JSON,
// an officer's session (401 signed_out, D99). {post, on, channel, title, language}: one catalog post's switch
// and settings. 403 not_allowed when the owner does not allow the post (D134); 400 bad_channel or too_long
// (a title past 80 graphemes once cleaned); 429 rate_limited. The save counts as `ws_action` `posts` /
// `turn_on` or `turn_off` when the switch changed, else `save`, with `post`; a save of the same values counts
// nothing. The title never leaves in a log or an event.
import { requireWorkspace } from "@/lib/private/access";
import { withActionEvent } from "@/lib/private/desk-action";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { postInput, savePostFor } from "@/lib/private/post-settings";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS = { not_allowed: 403, bad_channel: 400, too_long: 400, rate_limited: 429 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = postInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/posts", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const done = await privately("posts.save", () => savePostFor(db, access, input, now));
    if (!done.ok) return privateError(STATUS[done.code], done.code);
    const body = Response.json(
      { post: input.post, on: input.on, title: done.title },
      { headers: NO_STORE },
    );
    if (!done.event) return body;
    return withActionEvent(ctx, access, "posts", done.event, body, { post: input.post });
  });
}
