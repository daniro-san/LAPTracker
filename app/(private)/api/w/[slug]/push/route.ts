// POST /api/w/[slug]/push — Alliance settings → Notifications (D148). Officers only: same origin, JSON, an
// officer's session (401 signed_out, D99). {action: "subscribe", subscription, uses, language} turns this
// device on; {action: "uses", endpoint, uses, language} changes what it is on for; {action: "unsubscribe",
// endpoint} turns it off; {action: "language", endpoint, language} follows the desk's language switch. Only the signed-in officer's own device rows are written. 403 turned_off without
// the site's push keys; 404 not_found for a device with no row; 429 rate_limited. Counted as `ws_action`
// `push` / `add`, `save` or `delete`. The subscription is never logged or answered.
import { requireWorkspace } from "@/lib/private/access";
import { withActionEvent } from "@/lib/private/desk-action";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { pushInput, savePush } from "@/lib/private/push-settings";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS = { turned_off: 403, not_found: 404, rate_limited: 429 } as const;
const ACTION = { subscribe: "add", uses: "save", language: "save", unsubscribe: "delete" } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = pushInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/push", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const done = await privately("push.save", () => savePush(db, access, input, ctx.env, now));
    if (!done.ok) return privateError(STATUS[done.code], done.code);
    const body = Response.json({ ok: true }, { headers: NO_STORE });
    return withActionEvent(ctx, access, "push", ACTION[input.action], body);
  });
}
