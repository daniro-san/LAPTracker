// POST /api/w/[slug]/notices/reviews — review requests on notices (issue 402, D113). Officers only: no
// session or a member's answers 401 signed_out (D99, D105). Each write carries the sheet's or button's
// request id (D100), so a repeat stores nothing new. Nothing is sent outside the app; the log carries codes.
//   {action: "ask", notice, language | null, reviewer | null, requestId}  → 200 {id}, 404, 400 reviewer
//   {action: "approve", review, requestId}  → 200, 404, 403 not_reviewer, 409 closed
import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
import { featureOn } from "@/lib/private/features";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { privateLog } from "@/lib/private/log";
import { answerReview, askReview, reviewBody } from "@/lib/private/notice-reviews";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS = { not_found: 404, not_reviewer: 403, closed: 409 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = reviewBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/notices/reviews", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    if (!featureOn(access, "notices")) return privateError(403, "turned_off");
    const body = parsed.data;
    if (body.action === "ask") {
      const asked = await askReview(db, access, body, body.requestId, now);
      if (!asked.ok) return privateError(asked.reason === "not_found" ? 404 : 400, asked.reason);
      privateLog("notices.review.asked", { whole: body.language === null ? 1 : 0 });
      const made = Response.json({ id: asked.id }, { headers: NO_STORE });
      return counted(ctx, access, "notice_review", "ask", made);
    }
    const answer = { review: body.review, outcome: "approved" as const };
    const result = await answerReview(db, access, answer, body.requestId, now);
    if (result !== "ok") return privateError(STATUS[result], result);
    privateLog("notices.review.approved", {});
    const done = Response.json({ ok: true }, { headers: NO_STORE });
    return counted(ctx, access, "notice_review", "approve", done);
  });
}
