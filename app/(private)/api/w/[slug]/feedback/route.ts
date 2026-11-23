// POST /api/w/[slug]/feedback (D157, issue 713): "Send feedback" from the desk or the board, to the site's
// owner. Same origin and JSON first, a strict body, then the door of the area it names: `desk` is the
// officers' (requireWorkspace), `board` the board's (requireBoard, officers and members) while the board is
// on. 200 `{ok: true}` whatever the honeypot held; 429 past the day's limits. Nothing about the sender is
// stored, nothing is logged, and an error leaves as its code alone (`privately`). Excluded from the
// officer-route walk in member-session.test.ts (members send from the board): tested in route.test.ts here.
// An optional picture rides in the JSON as base64 (D157 amended 2026-11-22), so the same-origin JSON rule
// still holds; a body that states more than FEEDBACK_BODY_MAX is refused unread, and a refused picture answers D119's codes.
import { clientIp } from "@/lib/auth";
import { requireBoard, requireWorkspace } from "@/lib/private/access";
import { featureOn } from "@/lib/private/features";
import {
  FEEDBACK_BODY_MAX,
  FEEDBACK_SEND,
  sendFeedback,
  type FeedbackSender,
} from "@/lib/private/feedback";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

type Params = { params: Promise<{ slug: string }> };

/** D119's answers for a picture it refuses. */
const PICTURE_STATUS = {
  empty: 400,
  too_large: 413,
  wrong_type: 415,
  too_big_sides: 422,
  animated: 422,
};

export async function POST(request: Request, { params }: Params): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const stated = request.headers.get("content-length");
  if (stated !== null && !(Number(stated) <= FEEDBACK_BODY_MAX))
    return privateError(413, "too_large");
  const parsed = FEEDBACK_SEND.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/feedback", slug, async (ctx, db) => {
    const jar = requestCookies(request);
    const now = ctx.now();
    let from: FeedbackSender;
    if (parsed.data.area === "desk") {
      // INVARIANT workspace.member-board-only: the desk's feedback is an officer's.
      const access = await requireWorkspace(db, slug, jar, now);
      if (!access.ok) return privateError(401, "signed_out");
      from = { workspaceId: access.workspaceId, slug: access.slug, tier: "officer" };
    } else {
      const board = await requireBoard(db, slug, jar, now);
      if (!board.ok) return privateError(401, "signed_out");
      if (!featureOn(board, "board")) return privateError(403, "turned_off");
      from = {
        workspaceId: board.workspaceId,
        slug: board.slug,
        tier: board.officer ? "officer" : "member",
      };
    }
    const ip = { address: clientIp(request.headers), secret: ctx.env.CRON_SECRET };
    const result = await privately("feedback.send", () =>
      sendFeedback(db, from, parsed.data, ip, now),
    );
    if (result === "bad") return privateError(400, "bad_request");
    if (result === "too_many") return privateError(429, "too_many");
    if (result !== "ok") return privateError(PICTURE_STATUS[result], result);
    return Response.json({ ok: true }, { headers: NO_STORE });
  });
}
