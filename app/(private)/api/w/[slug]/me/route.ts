// /api/w/[slug]/me (D142): a member's own "This is me" on the members' board. POST (same origin, JSON)
// claims a player of the alliance's newest roster, or drops the member's own link. The door is the board's
// (requireBoard), so a member's session gets in; the only row written is the session's own user. The
// answer is the link's state or an error code. Nothing here is logged or counted.
import { z } from "zod";

import { requireBoard } from "@/lib/private/access";
import { featureOn } from "@/lib/private/features";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { claimPlayer, dropOwnLink } from "@/lib/private/me-link";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const ROUTE = "/api/w/[slug]/me";

const body = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("claim"),
      uid: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    })
    .strict(),
  z.object({ action: z.literal("drop") }).strict(),
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
    const board = await requireBoard(db, slug, requestCookies(request), ctx.now());
    if (!board.ok) return privateError(401, "signed_out");
    if (!featureOn(board, "board")) return privateError(403, "turned_off");
    if (input.action === "drop") {
      await dropOwnLink(db, board);
      return Response.json({ state: null }, { headers: NO_STORE });
    }
    const result = await claimPlayer(db, board, input.uid, ctx.now());
    if (result === "not_in_alliance") return privateError(400, result);
    if (typeof result === "string") return privateError(409, result);
    return Response.json(result, { headers: NO_STORE });
  });
}
