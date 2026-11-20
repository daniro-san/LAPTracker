// POST /api/w/[slug]/notices {id?, changes} — saves a notice's changed fields (issue 304), or makes a new
// notice when there is no id. A write: same origin, JSON, a valid session. A field someone else saved after
// the version the officer was looking at answers 409 with the newer text, and nothing is written (issue 293).
// A save from a review request closes it as "Edited by …" in the same transaction (D113); a request that is
// not the officer's, or that someone already answered, stays as it was, and the save still counts.
import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
import { featureOn } from "@/lib/private/features";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { answerReview } from "@/lib/private/notice-reviews";
import { noticeSave, saveNotice } from "@/lib/private/notices";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = noticeSave.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/notices", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    if (!featureOn(access, "notices")) return privateError(403, "turned_off");
    const { id, changes, requestId, review } = parsed.data;
    const close =
      review &&
      ((tx: Parameters<typeof answerReview>[0], notice: number) =>
        answerReview(
          tx,
          access,
          { review: review.id, outcome: "edited", notice },
          review.requestId,
          now,
        ));
    const result = await saveNotice(db, access, id ?? null, changes, now, requestId ?? null, close);
    if (result.ok) {
      const saved = Response.json({ id: result.id }, { headers: NO_STORE });
      return counted(
        ctx,
        access,
        "notice",
        id === undefined || id === null ? "add" : "edit",
        saved,
      );
    }
    if (result.reason === "conflict") {
      return Response.json(
        { code: "conflict", conflicts: result.conflicts },
        { status: 409, headers: NO_STORE },
      );
    }
    // A notice in the trash answers 410 notice_deleted, so the editor can offer to restore it (D118).
    const status = { not_found: 404, notice_deleted: 410, no_title: 400 }[result.reason];
    return privateError(status, result.reason);
  });
}
