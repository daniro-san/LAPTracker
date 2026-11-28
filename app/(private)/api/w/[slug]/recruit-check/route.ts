// POST /api/w/[slug]/recruit-check — Members → Recruit check (issue 833): one new tracker read of a player the
// stores do not hold yet. Officers only: same origin, JSON, an officer's session (401 signed_out, D99). {uid}.
// 200 {called}: false when the player was stored already (no call). 403 turned_off (D126); 409 no_key: the
// alliance has no own key that reads now (never LAP_API_KEY, D124); 429 cap_reached: the day's reads are used
// (reset 00:00 UTC); 404 not_found: the tracker does not know the uid; 502 unavailable. Nothing of the
// player leaves in a log or an event.
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { readRecruit } from "@/lib/private/recruit-check";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const input = z.object({ uid: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict();

const STATUS = {
  turned_off: 403,
  no_key: 409,
  cap_reached: 429,
  not_found: 404,
  unavailable: 502,
} as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const { uid } = parsed.data;
  return withContext("/api/w/[slug]/recruit-check", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const deps = { v1: ctx.v1, secret: ctx.env.WORKSPACE_KEYS_SECRET, now };
    const done = await privately("recruit.read", () => readRecruit(db, deps, access, uid));
    if (!done.ok) return privateError(STATUS[done.code], done.code);
    return Response.json({ called: done.called }, { headers: NO_STORE });
  });
}
