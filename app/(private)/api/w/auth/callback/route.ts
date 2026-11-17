// GET /api/w/auth/callback — Discord's one redirect URI for every workspace (D73): the slug travels in
// `state`. A bad state is refused and counted in auth_attempts; anything else ends in a redirect to the
// page the officer came from (D99), the workspace, its sign-in page with a reason, or its no-access page.
import { clientIp } from "@/lib/auth";
import { privateError, redirectWith, requestCookies } from "@/lib/private/http";
import { SESSION_COOKIE } from "@/lib/private/session";
import { finishSignIn, STATE_COOKIE } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

export function GET(request: Request): Promise<Response> {
  return withContext("/api/w/auth/callback", async (ctx, db) => {
    const url = new URL(request.url);
    const jar = requestCookies(request);
    const step = await finishSignIn(
      db,
      { env: ctx.env, fetch: ctx.fetch, now: ctx.now() },
      {
        query: url.searchParams,
        stateCookie: jar.get(STATE_COOKIE)?.value,
        sessionCookie: jar.get(SESSION_COOKIE)?.value,
        ip: clientIp(request.headers),
        origin: url.origin,
      },
    );
    if (step.kind === "refused") return privateError(step.status, step.code);
    return redirectWith(step.location, step.cookies);
  });
}
