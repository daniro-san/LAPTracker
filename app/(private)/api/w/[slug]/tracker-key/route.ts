// POST /api/w/[slug]/tracker-key {action: "set", key, requestId} | {action: "remove", requestId} — the
// workspace's own tracker key (D124). Officers only: same origin, JSON, an officer's session (a member's
// answers 401). The key is checked at the boundary (a `lap_` key), tested with one /quota call on itself
// and stored sealed. No answer carries the key: only its state, last 4 characters and quota left.
import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import {
  removeTrackerKey,
  saveTrackerKey,
  trackerKeyInput,
  type TrackerKeyView,
} from "@/lib/private/tracker-key";
import { withContext } from "@/lib/route";

const FAILED = {
  refused: [422, "key_refused"],
  unreachable: [503, "tracker_unreachable"],
  off: [503, "keys_off"],
  rate_limited: [429, "rate_limited"],
} as const;

const answer = (view: TrackerKeyView) =>
  Response.json(
    { state: view.state, last4: view.last4, quotaRemaining: view.quotaRemaining },
    { headers: NO_STORE },
  );

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = trackerKeyInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/tracker-key", async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    if (input.action === "remove") {
      const view = await removeTrackerKey(db, access, ctx.env, input, now);
      return counted(ctx, access, "tracker_key", "delete", answer(view));
    }
    const result = await saveTrackerKey(db, access, { env: ctx.env, v1: ctx.v1, now }, input);
    if (!result.ok) {
      const [status, code] = FAILED[result.code];
      return privateError(status, code);
    }
    return counted(ctx, access, "tracker_key", "save", answer(result.view));
  });
}
