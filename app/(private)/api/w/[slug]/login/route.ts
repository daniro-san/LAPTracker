// GET /api/w/[slug]/login[?silent=1][&next=/w/<slug>/…] — the "Sign in with Discord" button (D71): sets
// the 10-minute state cookie and sends the browser to Discord's authorize page. `silent=1` is the renewal
// that asks the officer nothing (prompt=none, D99). `next` is the page to return to; one outside this
// workspace is dropped (returnPath). Nothing private is read here.
import { z } from "zod";

import { privateError, redirectWith } from "@/lib/private/http";
import { countSignIn, SLUG, startSignIn } from "@/lib/private/sign-in";
import { parseQuery, withContext } from "@/lib/route";

const query = z
  .object({ silent: z.literal("1").optional(), next: z.string().max(512).optional() })
  .strict();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const parsed = parseQuery(request, query);
  if (!SLUG.test(slug) || !parsed) return privateError(404, "not_found");
  return withContext("/api/w/[slug]/login", slug, async (ctx, db) => {
    const deps = { env: ctx.env, fetch: ctx.fetch, now: ctx.now() };
    const origin = new URL(request.url).origin;
    const silent = parsed.silent === "1";
    const step = await startSignIn(db, deps, slug, origin, silent, parsed.next);
    countSignIn(ctx, "workspace", step, { silent });
    if (step.kind === "refused") return privateError(step.status, step.code);
    return redirectWith(step.location, step.cookies);
  });
}
