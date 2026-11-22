// POST /api/w/invite — the invite's steps after Discord sign-in (D130, issue 453). Same origin, JSON, the
// invite cookie and this browser's claim cookie.
//   {action: "server", guild_id}                       pick the server (one Discord listed for her, not taken)
//   {action: "roles"}                                  the server's roles through the bot
//   {action: "create_roles", leader, member, give_me}  create the two roles (needs Manage Roles)
//   {action: "finish", leader_role_ids, member_role_ids}  make the workspace and sign her in
// Answers carry codes, role names and colours only; "finish" sets the officer's session cookie, and the owner
// gets one line in the admin Discord channel (issue 500), and it counts as `ws_action` `workspace` / `create`.
import { createNotifier } from "@/lib/notify";
import { deskMadeMessage } from "@/lib/notify-request";
import { withActionEvent } from "@/lib/private/desk-action";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { inviteInput, inviteStep, type StepCode } from "@/lib/private/invite-steps";
import { withContext } from "@/lib/route";

const STATUS: Record<StepCode, number> = {
  signed_out: 401,
  closed: 410,
  rate_limited: 429,
  not_yours: 403,
  taken: 409,
  has_desk: 409,
  no_server: 409,
  bot_off: 503,
  bot_missing: 409,
  no_permission: 409,
  bad_role: 400,
  unreachable: 503,
};

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = inviteInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/invite", async (ctx, db) => {
    const deps = { env: ctx.env, fetch: ctx.fetch, now: ctx.now(), report: ctx.report };
    const result = await inviteStep(db, deps, requestCookies(request), parsed.data);
    if (!result.ok) return privateError(STATUS[result.code], result.code);
    if ("slug" in result) {
      await createNotifier(ctx.env, ctx.fetch)
        .admin(deskMadeMessage(result))
        .catch(() => null);
      const headers = new Headers(NO_STORE);
      headers.append("Set-Cookie", result.cookie);
      // Issue 486: the setup funnel's first step, on the new officer's pseudonymous id and the new workspace.
      // An alliance with no label yet gets its union id as the tag (allianceOf); the desk's events send null.
      const tag = result.tag === String(result.unionId) ? null : result.tag;
      const made = { slug: result.slug, alliance: { tag }, user: { id: result.userId } };
      return withActionEvent(
        ctx,
        made,
        "workspace",
        "create",
        Response.json({ slug: result.slug }, { headers }),
      );
    }
    return Response.json(
      {
        roles: result.roles ?? null,
        gave: result.gave ?? null,
        member_failed: result.memberFailed ?? null,
      },
      { headers: NO_STORE },
    );
  });
}
