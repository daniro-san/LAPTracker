// POST /api/w/[slug]/members/[uid]/left-reason {version, reason, note} — an officer records why a former
// member left (issue 469, D107 amendment 2026-11-27): same origin, a JSON body and an officer session of
// this workspace (D71). 200 with the saved version; 409 with the newer reason another officer saved since
// the version sent. 404 when the uid is not a former member of the workspace's own alliance.
import { requireWorkspace } from "@/lib/private/access";
import { withActionEvent } from "@/lib/private/desk-action";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { LEFT_CHANGE, saveLeftReason } from "@/lib/private/left-reason";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

/** A game uid: only former members, never a pending member. */
const UID = /^[1-9]\d{0,15}$/;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; uid: string }> },
): Promise<Response> {
  const { slug, uid } = await params;
  if (!SLUG.test(slug) || !UID.test(uid)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = LEFT_CHANGE.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/members/[uid]/left-reason", slug, async (ctx, db) => {
    const access = await requireWorkspace(db, slug, requestCookies(request), ctx.now());
    if (!access.ok) return privateError(401, "signed_out");
    const result = await privately("left_reason.save", () =>
      saveLeftReason(db, access, Number(uid), parsed.data, ctx.now()),
    );
    if (!result) return privateError(404, "not_former");
    const status = result.status === "conflict" ? 409 : 200;
    const saved = Response.json(result, { status, headers: NO_STORE });
    return withActionEvent(ctx, access, "left_reason", "save", saved);
  });
}
