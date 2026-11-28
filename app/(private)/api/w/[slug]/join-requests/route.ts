// POST /api/w/[slug]/join-requests (issue 868): an officer answers a `/join` request on Members → Requests.
//   {action: "approve", id, uid}  link the Discord user to that player (approved), give the member role, welcome
//   {action: "decline", id}       delete the request; nothing is posted
// Officers only: same origin, JSON, an officer's session of this workspace (a member's or another workspace's
// answers 401 signed_out). Only this workspace's requests are found. The answer carries codes only: whether
// the role was given and the welcome posted, never a name or an id. Each answer counts as `ws_action`
// `join_request`.
import { z } from "zod";

import { requireWorkspace } from "@/lib/private/access";
import { withActionEvent } from "@/lib/private/desk-action";
import { featureOn } from "@/lib/private/features";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { answerJoinRequest } from "@/lib/private/join-requests";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const ROUTE = "/api/w/[slug]/join-requests";

const id = z.number().int().positive().max(2_147_483_647);
const body = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("approve"),
      id,
      uid: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    })
    .strict(),
  z.object({ action: z.literal("decline"), id }).strict(),
]);

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext(ROUTE, slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    // D126: turned off for the alliance, the requests are not answered.
    if (!featureOn(access, "discord_join")) return privateError(404, "not_found");
    const deps = { env: ctx.env, fetch: ctx.fetch, report: ctx.report };
    const answer = await answerJoinRequest(db, access, deps, input, now);
    if (!answer.ok) return privateError(answer.code === "taken" ? 409 : 404, answer.code);
    const done = Response.json(answer, { headers: NO_STORE });
    return withActionEvent(ctx, access, "join_request", input.action, done);
  });
}
