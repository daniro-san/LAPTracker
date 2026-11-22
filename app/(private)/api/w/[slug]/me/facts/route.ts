// POST /api/w/[slug]/me/facts (D154, issue 301): a member tells their officers their own Alliance Duel tech,
// time zone and languages from their own page. Behind the board's door (requireBoard) and an approved link
// (meAccess): the uid is the link's, never the request's, and the body is strict, so it names no uid. Same
// origin, JSON, a request id (D100) and a daily limit. 200 with the member's reports as now stored; 409 with
// them when another tab sent a field since (the other fields are saved). Nothing is logged; an error leaves
// as its code alone (`privately`). Excluded from the officer-route walk in member-session.test.ts: tested in
// route.test.ts here.
import { meAccess, requireBoard } from "@/lib/private/access";
import { featureOn } from "@/lib/private/features";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { REPORT_SEND, sendReport } from "@/lib/private/self-report";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

type Params = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = REPORT_SEND.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/me/facts", slug, async (ctx, db) => {
    const board = await requireBoard(db, slug, requestCookies(request), ctx.now());
    if (!board.ok) return privateError(401, "signed_out");
    if (!featureOn(board, "board")) return privateError(403, "turned_off");
    const me = meAccess(board);
    // INVARIANT me.link-approved: a pending, rejected or removed link sends nothing.
    if (!me) return privateError(403, "not_linked");
    const result = await privately("self_report.send", () =>
      sendReport(db, board, me, parsed.data, ctx.now()),
    );
    if (result === "left") return privateError(409, "left");
    if (result === "too_many") return privateError(429, "too_many");
    const status = result.conflict ? 409 : 200;
    return Response.json({ reports: result.reports }, { status, headers: NO_STORE });
  });
}
