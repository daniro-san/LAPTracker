// POST /api/w/[slug]/import/[id] {action: save | discard | retype, version, …} — an officer's decision on a
// draft (issue 299). The first save or discard wins: a second one with the same version gets 409 and who
// did it. Nothing counts before a save (D75).
import { requireWorkspace } from "@/lib/private/access";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { discardDraft, retype, saveDraft, type SaveResult } from "@/lib/private/import";
import { actionBody, screenOf } from "@/lib/private/import-input";
import { privateLog } from "@/lib/private/log";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS: Record<Exclude<SaveResult, { ok: true }>["code"], number> = {
  gone: 404,
  already_saved: 409,
  discarded: 409,
  changed: 409,
  bad_rows: 400,
  cannot_save: 400,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> },
): Promise<Response> {
  const { slug, id } = await params;
  if (!SLUG.test(slug) || !/^\d{1,9}$/.test(id)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const body = actionBody.safeParse(await request.json().catch(() => null));
  if (!body.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/import/[id]", async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, access.reason);
    const input = body.data;
    const draft = Number(id);
    const result =
      input.action === "save"
        ? await saveDraft(db, access, draft, input, now)
        : input.action === "discard"
          ? await discardDraft(db, access, draft, input.version, now)
          : await retype(db, access, draft, input.version, screenOf(input.kind, input.scope), now);
    privateLog(`w.import.${input.action}`, {
      workspace: access.workspaceId,
      ok: result.ok ? 1 : 0,
    });
    if (result.ok) return Response.json({ ok: true }, { headers: NO_STORE });
    return Response.json(
      { code: result.code, by: result.by ?? null },
      { status: STATUS[result.code], headers: NO_STORE },
    );
  });
}
