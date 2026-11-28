// POST /api/w/[slug]/kvk-plan — a KvK calendar entry's plan (issue 790, D161). Officers only (401
// signed_out, D99); same origin and JSON (D71); under the Notices switch (D126), as its output is a notice.
//   {action: "save", entry, rev, roles, note}: the roles and the note over version `rev`; 409 stale when
//     another officer saved first, 400 invalid when a role names someone not on the newest roster.
//   {action: "message", entry, week, requestId}: a new notice draft from the saved plan, in the officer's
//     language, once per request id (D100); answers its id for the notice editor.
// The lib calls run in `privately`, so an error leaves as a code; nothing about members is logged.
import { requireWorkspace } from "@/lib/private/access";
import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import { withActionEvent } from "@/lib/private/desk-action";
import { pickWorkspaceLanguage, WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { featureOn } from "@/lib/private/features";
import {
  isSameOriginJson,
  NO_STORE,
  privately,
  privateError,
  requestCookies,
} from "@/lib/private/http";
import { kvkPlanInput, makeKvkMessage, saveKvkPlan } from "@/lib/private/kvk-plan";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS = { not_found: 404, invalid: 400, stale: 409 } as const;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = kvkPlanInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  const jar = requestCookies(request);
  return withContext("/api/w/[slug]/kvk-plan", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, jar, now);
    if (!access.ok) return privateError(401, "signed_out");
    if (!featureOn(access, "notices")) return privateError(403, "turned_off");
    if (input.action === "save") {
      const saved = await privately("kvk_plan.save", () => saveKvkPlan(db, access, input, now));
      if (!saved.ok) return privateError(STATUS[saved.code], saved.code);
      const body = Response.json({ ok: true, rev: saved.rev }, { headers: NO_STORE });
      return withActionEvent(ctx, access, "kvk_plan", "save", body);
    }
    const language = pickWorkspaceLanguage(
      jar.get(WORKSPACE_LANG_COOKIE)?.value,
      request.headers.get("accept-language"),
    );
    const t = WORKSPACE_DICTIONARIES[language];
    const made = await privately("kvk_plan.message", () =>
      makeKvkMessage(db, access, input, now, { t, language }),
    );
    if (!made.ok) return privateError(404, made.code);
    const body = Response.json({ ok: true, id: made.id }, { headers: NO_STORE });
    return withActionEvent(ctx, access, "kvk_plan", "draft", body);
  });
}
