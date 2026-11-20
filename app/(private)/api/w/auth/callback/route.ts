// GET /api/w/auth/callback — Discord's one redirect URI for every workspace (D73): the slug travels in
// `state`. A bad state is refused and counted in auth_attempts; anything else ends in a redirect to the
// page the officer came from (D99), the workspace, its sign-in page with a reason, or its no-access page.
// A state starting `invite.` is a sign-in through a new alliance's invite link (D130).
import { clientIp } from "@/lib/auth";
import { privateError, redirectWith, requestCookies } from "@/lib/private/http";
import { finishInviteSignIn, INVITE_STATE_PREFIX } from "@/lib/private/invite-sign-in";
import { SESSION_COOKIE } from "@/lib/private/session";
import { finishSignIn, STATE_COOKIE } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

export function GET(request: Request): Promise<Response> {
  return withContext("/api/w/auth/callback", async (ctx, db) => {
    const url = new URL(request.url);
    const jar = requestCookies(request);
    const deps = { env: ctx.env, fetch: ctx.fetch, now: ctx.now() };
    const common = {
      query: url.searchParams,
      stateCookie: jar.get(STATE_COOKIE)?.value,
      ip: clientIp(request.headers),
      origin: url.origin,
    };
    const step = url.searchParams.get("state")?.startsWith(INVITE_STATE_PREFIX)
      ? await finishInviteSignIn(db, deps, { ...common, jar })
      : await finishSignIn(db, deps, { ...common, sessionCookie: jar.get(SESSION_COOKIE)?.value });
    if (step.kind === "refused") return privateError(step.status, step.code);
    return redirectWith(step.location, step.cookies);
  });
}
