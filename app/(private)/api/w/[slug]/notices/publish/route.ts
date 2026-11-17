// POST /api/w/[slug]/notices/publish {id, languages, requestId} — "Publish to Discord" (issue 345, D102):
// posts the notice to its audience's channel, once per request id. A write: same origin, JSON, a valid
// session (401 signed_out, D99). Answers who posted it and when, or a code: not_set_up (no channel for this
// audience), no_text, posting (the same request is still running), recent (this notice went to this
// audience in the last 30 s), failed (Discord refused, timed out or ran past the budget).
import { requireWorkspace } from "@/lib/private/access";
import {
  isSameOriginJson,
  NO_STORE,
  privately,
  privateError,
  requestCookies,
} from "@/lib/private/http";
import { noticeChannels, publishInput, publishNotice } from "@/lib/private/notice-publish";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

import { LANGUAGE_NAME } from "../../../../../_ui/languages";

const STATUS = {
  not_found: 404,
  not_set_up: 409,
  no_text: 400,
  posting: 409,
  recent: 409,
  failed: 502,
} as const;

/** Every message has its own 5 s limit and the publish a 40 s budget (D102). */
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = publishInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/notices/publish", async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const result = await privately("notices.publish", () =>
      publishNotice(db, access, parsed.data, {
        fetch: ctx.fetch,
        now,
        channels: noticeChannels(ctx.env, slug),
        names: LANGUAGE_NAME,
      }),
    );
    if (!result.ok) return privateError(STATUS[result.code], result.code);
    const { audience, languages, at } = result.row;
    return Response.json({ audience, languages, at }, { headers: NO_STORE });
  });
}
