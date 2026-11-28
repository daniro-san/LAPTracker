// GET /api/w/login — "Sign in with Discord" on /w (D131, issue 457): the state cookie, then Discord asking for
// the workspace sign-in's scopes plus `guilds`. Discord answers on D73's one callback, which sends a `w.`
// state to the chooser. Nothing private is read here.
import { startChooserSignIn } from "@/lib/private/chooser";
import { privateError, redirectWith } from "@/lib/private/http";
import { countSignIn } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

export function GET(request: Request): Promise<Response> {
  return withContext("/api/w/login", async (ctx) => {
    const deps = { env: ctx.env, fetch: ctx.fetch, now: ctx.now() };
    const step = startChooserSignIn(deps, new URL(request.url).origin);
    countSignIn(ctx, "chooser", step, { silent: false });
    if (step.kind === "refused") return privateError(step.status, step.code);
    return redirectWith(step.location, step.cookies);
  });
}
