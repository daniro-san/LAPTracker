// /api/w/[slug]/member-links (D142): an officer approves a member's pending "This is me" link (Home's "To
// review") or removes a link (Reject, or the member card's "Remove link"). POST, same origin, JSON, naming
// the claim the officer saw: the workspace user and the player. A claim that changed since (dropped, or
// another player claimed) answers 404, so an answer never reaches a later claim; only this workspace's users
// are touched. Nothing here is logged.
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import { withActionEvent } from "@/lib/private/desk-action";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { decideLink } from "@/lib/private/me-link";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const ROUTE = "/api/w/[slug]/member-links";

const body = z
  .object({
    action: z.enum(["approve", "unlink"]),
    user: z.number().int().positive().max(2_147_483_647),
    uid: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  })
  .strict();

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext(ROUTE, slug, async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    const result = await decideLink(
      db,
      access,
      { userId: input.user, uid: input.uid },
      input.action,
    );
    if (result === "none") return privateError(404, "not_found");
    if (result === "taken") return privateError(409, "taken");
    const done = Response.json({ ok: true }, { headers: NO_STORE });
    return withActionEvent(ctx, access, "member_link", input.action, done);
  });
}
