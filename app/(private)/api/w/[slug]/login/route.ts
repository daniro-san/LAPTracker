// GET /api/w/[slug]/login[?silent=1] — the "Sign in with Discord" button (D71): sets the 10-minute state
// cookie and sends the browser to Discord's authorize page. `silent=1` is the re-authorisation after
// 24 hours (prompt=none). Nothing private is read here.
import { z } from "zod";

import { privateError, redirectWith } from "@/lib/private/http";
import { SLUG, startSignIn } from "@/lib/private/sign-in";
import { parseQuery, withContext } from "@/lib/route";

const query = z.object({ silent: z.literal("1").optional() }).strict();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const parsed = parseQuery(request, query);
  if (!SLUG.test(slug) || !parsed) return privateError(404, "not_found");
  return withContext("/api/w/[slug]/login", async (ctx, db) => {
    const deps = { env: ctx.env, fetch: ctx.fetch, now: ctx.now() };
    const origin = new URL(request.url).origin;
    const step = await startSignIn(db, deps, slug, origin, parsed.silent === "1");
    if (step.kind === "refused") return privateError(step.status, step.code);
    return redirectWith(step.location, step.cookies);
  });
}
