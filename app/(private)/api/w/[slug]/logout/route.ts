// POST /api/w/[slug]/logout {} — "Sign out" (D71): a write, so same origin and a JSON body; ends this
// browser's session of this workspace and clears the cookie.
import { z } from "zod";

import { signOut } from "@/lib/private/access";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { clearSessionCookie } from "@/lib/private/session";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const body = z.object({}).strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  if (!body.safeParse(await request.json().catch(() => null)).success) {
    return privateError(400, "bad_request");
  }
  return withContext("/api/w/[slug]/logout", slug, async (ctx, db) => {
    const ended = await signOut(db, slug, requestCookies(request), ctx.now());
    if (!ended) return privateError(401, "signed_out");
    return Response.json(
      { ok: true },
      { headers: { ...NO_STORE, "Set-Cookie": clearSessionCookie() } },
    );
  });
}
