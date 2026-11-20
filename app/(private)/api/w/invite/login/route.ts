// GET /api/w/invite/login — "Sign in with Discord" on an invite (D130): the state cookie, then Discord asking
// for `identify guilds`. Discord answers on D73's one callback, which sends an `invite.` state back here.
import { privateError, redirectWith, requestCookies } from "@/lib/private/http";
import { startInviteSignIn } from "@/lib/private/invite-sign-in";
import { withContext } from "@/lib/route";

export function GET(request: Request): Promise<Response> {
  return withContext("/api/w/invite/login", async (ctx, db) => {
    const deps = { env: ctx.env, fetch: ctx.fetch, now: ctx.now() };
    const origin = new URL(request.url).origin;
    const step = await startInviteSignIn(db, deps, requestCookies(request), origin);
    if (step.kind === "refused") return privateError(step.status, step.code);
    return redirectWith(step.location, step.cookies);
  });
}
