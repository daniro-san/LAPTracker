// POST /api/w/[slug]/notices/delete {id, requestId, undo?} — deletes a notice of the workspace, or takes the
// officer's own delete back for a short while (D118). Officers only: no session or a member's answers 401
// signed_out (D99, D105). The delete sheet's request id (D100) makes a repeat change nothing, and Undo names
// it. A deleted notice leaves every list; what was posted to Discord stays there. → 200, 404 not_found.
import { requireWorkspace } from "@/lib/private/access";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { privateLog } from "@/lib/private/log";
import { deleteNotice, noticeDelete } from "@/lib/private/notices";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = noticeDelete.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/notices/delete", async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const result = await deleteNotice(db, access, parsed.data, now);
    if (result !== "ok") return privateError(404, result);
    privateLog(parsed.data.undo ? "notices.delete.undone" : "notices.deleted", {});
    return Response.json({ ok: true }, { headers: NO_STORE });
  });
}
