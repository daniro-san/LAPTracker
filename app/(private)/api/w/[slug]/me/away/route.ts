// POST /api/w/[slug]/me/away (issue 829, D154 amended): a member sets their own first and last day away, or
// clears them, from their own page. Behind the board's door (requireBoard) and an approved link (meAccess):
// the uid is the link's, never the request's, and the body is strict, so it names no uid. Same origin and
// JSON. 200 with the days as now stored (null once cleared); 409 when another tab wrote since. Nothing is
// logged; an error leaves as its code alone (`privately`). Excluded from the officer-route walk in
// member-session.test.ts: tested in route.test.ts here.
import { meAccess, requireBoard } from "@/lib/private/access";
import { featureOn } from "@/lib/private/features";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { AWAY_SEND, sendAway } from "@/lib/private/self-report";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = AWAY_SEND.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/me/away", slug, async (ctx, db) => {
    const board = await requireBoard(db, slug, requestCookies(request), ctx.now());
    if (!board.ok) return privateError(401, "signed_out");
    if (!featureOn(board, "board")) return privateError(403, "turned_off");
    const me = meAccess(board);
    // INVARIANT me.link-approved: a pending, rejected or removed link sends nothing.
    if (!me) return privateError(403, "not_linked");
    const result = await privately("self_report.away", () =>
      sendAway(db, board, me, parsed.data, ctx.now(), ctx.env.SERVER_TZ),
    );
    if (result === "left" || result === "conflict") return privateError(409, result);
    if (result === "past" || result === "far") return privateError(400, result);
    return Response.json({ away: result.away }, { headers: NO_STORE });
  });
}
