// POST /api/w/[slug]/workspace-deletion {action: "ask", address, requestId} | {action: "cancel", requestId}
// — "Delete this workspace" and "Cancel the deletion" (D125). Officers only: same origin, JSON, an officer's
// session (a member's answers 401). Asking needs the workspace's own address, typed; the deletion happens
// 14 days later, and any officer can cancel it until then. Answers when the workspace will be deleted.
import { requireWorkspace } from "@/lib/private/access";
import { withActionEvent } from "@/lib/private/desk-action";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { askToDelete, cancelToDelete, deletionInput } from "@/lib/private/workspace-deletion";
import { withContext } from "@/lib/route";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = deletionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/workspace-deletion", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const result =
      input.action === "ask"
        ? await askToDelete(db, access, input, now)
        : await cancelToDelete(db, access, input, now);
    if (!result.ok) return privateError(400, result.code);
    const answer = Response.json(
      { purgeAfter: result.purgeAfter?.toISOString() ?? null },
      { headers: NO_STORE },
    );
    return withActionEvent(
      ctx,
      access,
      "workspace_data",
      input.action === "ask" ? "delete" : "cancel",
      answer,
    );
  });
}
