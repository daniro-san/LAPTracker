// GET /api/w/auth/callback — Discord's one redirect URI for every workspace (D73): the slug travels in
// `state`. A bad state is refused and counted in auth_attempts; anything else ends in a redirect to the
// page the officer came from (D99), the workspace, its sign-in page with a reason, or its no-access page.
// A state starting `invite.` is a sign-in through a new alliance's invite link (D130); one starting `w.` is
// the sign-in chooser at /w (D131).
import { clientIp } from "@/lib/auth";
import { CHOOSER_STATE_PREFIX, finishChooserSignIn } from "@/lib/private/chooser";
import { privateError, redirectWith, requestCookies } from "@/lib/private/http";
import { finishInviteSignIn, INVITE_STATE_PREFIX } from "@/lib/private/invite-sign-in";
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
    const state = url.searchParams.get("state") ?? "";
    const step = state.startsWith(INVITE_STATE_PREFIX)
      ? await finishInviteSignIn(db, deps, { ...common, jar })
      : state.startsWith(CHOOSER_STATE_PREFIX)
        ? await finishChooserSignIn(db, deps, { ...common, cookies: jar })
        : await finishSignIn(db, deps, { ...common, cookies: jar });
    if (step.kind === "refused") return privateError(step.status, step.code);
    return redirectWith(step.location, step.cookies);
  });
}
