// POST /api/w/[slug]/me/kvk (issue 831, D161 amended): a member says "I'm in" for a role of the open KvK's
// plan, or withdraws it while no officer has confirmed it, from their own page. Behind the board's door
// (requireBoard), the board and Notices switches (D126: the plan lives under Notices) and an approved link
// (meAccess): the uid is the link's, never the request's, and the body is strict, so it names no uid. Same
// origin and JSON. 404 when the role is not one of the open KvK's; 409 `confirmed` once an officer put the
// member in the role, `left` when the member is no longer on the roster. Nothing is logged; an error leaves
// as its code alone (`privately`). Excluded from the officer-route walk in member-session.test.ts: tested
// in route.test.ts here.
import { meAccess, requireBoard } from "@/lib/private/access";
import { featureOn } from "@/lib/private/features";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { claimKvkRole, kvkClaimInput } from "@/lib/private/kvk-claims";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

type Params = { params: Promise<{ slug: string }> };

const STATUS = { not_found: 404, left: 409, confirmed: 409 } as const;

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = kvkClaimInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/me/kvk", slug, async (ctx, db) => {
    const now = ctx.now();
    const board = await requireBoard(db, slug, requestCookies(request), now);
    if (!board.ok) return privateError(401, "signed_out");
    if (!featureOn(board, "board") || !featureOn(board, "notices"))
      return privateError(403, "turned_off");
    const me = meAccess(board);
    // INVARIANT me.link-approved: a pending, rejected or removed link sends nothing.
    if (!me) return privateError(403, "not_linked");
    const result = await privately("kvk_claim", () =>
      claimKvkRole(db, me, parsed.data, now, ctx.env.SERVER_TZ),
    );
    if (!result.ok) return privateError(STATUS[result.code], result.code);
    return Response.json({ ok: true }, { headers: NO_STORE });
  });
}
