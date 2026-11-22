// POST /api/w/[slug]/shots/[id] {action: save | discard | retype, version, …} — an officer's decision on a
// draft (issue 299). The first save or discard wins: a second one with the same version gets 409 and who
// did it. A member update that another officer changed meanwhile gets 409 with the newer values (D80).
// A Secret Ops save answers the thefts' counts (D97). Nothing counts before a save (D75).
import { requireWorkspace } from "@/lib/private/access";
import { withActionEvent } from "@/lib/private/desk-action";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { discardDraft, retype, saveDraft, type SaveResult } from "@/lib/private/import";
import { actionBody } from "@/lib/private/import-input";
import { privateLog } from "@/lib/private/log";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS: Record<Exclude<SaveResult, { ok: true }>["code"], number> = {
  gone: 404,
  already_saved: 409,
  discarded: 409,
  changed: 409,
  conflict: 409,
  bad_rows: 400,
  cannot_save: 400,
  not_in_alliance: 400,
  attacker_missing: 400,
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
  return withContext("/api/w/[slug]/shots/[id]", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const input = body.data;
    const draft = Number(id);
    // Facts and attacker names are what officers and pictures said: an error leaves as a code (D80).
    const result = await privately("shots_save", () =>
      input.action === "save"
        ? saveDraft(db, access, draft, input, { now, zone: ctx.env.SERVER_TZ })
        : input.action === "discard"
          ? discardDraft(db, access, draft, input.version, now)
          : retype(db, access, draft, input.version, { kind: input.kind, scope: input.scope }, now),
    );
    privateLog(`w.import.${input.action}`, {
      workspace: access.workspaceId,
      ok: result.ok ? 1 : 0,
    });
    if (result.ok) {
      const done = Response.json(result, { headers: NO_STORE });
      return withActionEvent(ctx, access, "screenshot_draft", input.action, done);
    }
    const { code, by = null, detail = null } = result;
    return Response.json({ code, by, detail }, { status: STATUS[code], headers: NO_STORE });
  });
}
