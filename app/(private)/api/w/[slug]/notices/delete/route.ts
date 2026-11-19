// POST /api/w/[slug]/notices/delete {id, requestId, undo? | restore?} — deletes a notice of the workspace,
// takes the officer's own delete back for a short while, or restores it from the trash (D118). Officers
// only: no session or a member's answers 401 signed_out (D99, D105). The request id (D100) makes a repeat
// change nothing, and Undo names the delete's. A deleted notice leaves every list; what was posted to
// Discord stays there. → 200, 404 not_found.
import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
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
  return withContext("/api/w/[slug]/notices/delete", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const result = await deleteNotice(db, access, parsed.data, now);
    if (result !== "ok") return privateError(404, result);
    const { undo, restore } = parsed.data;
    const action = restore ? "restore" : undo ? "undo" : "delete";
    privateLog(
      restore ? "notices.restored" : undo ? "notices.delete.undone" : "notices.deleted",
      {},
    );
    // ws_action (D115): notice / delete, undo or restore, counted on a 2xx only.
    return counted(
      ctx,
      access,
      "notice",
      action,
      Response.json({ ok: true }, { headers: NO_STORE }),
    );
  });
}
