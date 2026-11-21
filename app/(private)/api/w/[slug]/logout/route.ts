// POST /api/w/[slug]/logout {endpoint?} — "Sign out" (D71): a write, so same origin and a JSON body; ends this
// browser's session of this workspace and clears the cookie, and turns off this browser's notifications for
// the person signing out (D148).
import { z } from "zod";

import { signOut } from "@/lib/private/access";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { clearSessionCookie } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

/** endpoint: this browser's push subscription, turned off with the session (D148). */
const body = z.object({ endpoint: z.string().max(1024).optional() }).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const { endpoint } = parsed.data;
  return withContext("/api/w/[slug]/logout", slug, async (ctx, db) => {
    const ended = await signOut(db, slug, requestCookies(request), ctx.now(), endpoint);
    if (!ended) return privateError(401, "signed_out");
    return Response.json(
      { ok: true },
      { headers: { ...NO_STORE, "Set-Cookie": clearSessionCookie(ended) } },
    );
  });
}
