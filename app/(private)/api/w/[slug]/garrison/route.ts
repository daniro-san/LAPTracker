// POST /api/w/[slug]/garrison — an Undead Siege's garrison plan (issue 423, D121). Officers only (401
// signed_out, D99); same origin and JSON (D71).
//   {action: "enemy", entry, week, version, value}: this siege's enemy might over version `version`; 409
//     stale with the newer value when another officer saved first.
//   {action: "save", entry, week, rev, pairs}: the officer's pairs over version `rev`; 409 stale when
//     another officer saved first, 400 invalid when a pair breaks a rule (one squad per member, never the
//     helper's strongest squad, roster members only).
//   {action: "post", entry, week, channel, requestId}: the plan to the members' (default) or the leaders'
//     Discord channel (D102's webhook),
//     once per request id (D100); 409 no_enemy_might, not_saved (the enemy might is carried over from an
//     earlier siege and not saved for this one), not_set_up or posting, 502 failed.
// The lib calls run in `privately`, so an error leaves as a code; nothing about members is logged.
import { requireWorkspace } from "@/lib/private/access";
import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import { counted } from "@/lib/private/desk-action";
import { pickWorkspaceLanguage, WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { noticeChannels } from "@/lib/private/discord-webhooks";
import { featureOn } from "@/lib/private/features";
import { garrisonInput, saveEnemyMight, saveGarrison } from "@/lib/private/garrison";
import { postGarrison } from "@/lib/private/garrison-post";
import {
  isSameOriginJson,
  NO_STORE,
  privately,
  privateError,
  requestCookies,
} from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS = {
  not_found: 404,
  invalid: 400,
  stale: 409,
  no_enemy_might: 409,
  not_saved: 409,
  not_set_up: 409,
  posting: 409,
  failed: 502,
} as const;

/** Discord's messages have the notices' 5 s each within a 40 s budget (D102). */
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = garrisonInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  const jar = requestCookies(request);
  return withContext("/api/w/[slug]/garrison", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, jar, now);
    if (!access.ok) return privateError(401, "signed_out");
    if (!featureOn(access, "garrison")) return privateError(403, "turned_off");
    if (input.action === "enemy") {
      const set = await privately("garrison.enemy", () => saveEnemyMight(db, access, input, now));
      if (set.ok) {
        const body = Response.json({ ok: true, version: set.version }, { headers: NO_STORE });
        return counted(ctx, access, "garrison", "edit", body);
      }
      if (set.code === "not_found") return privateError(404, set.code);
      return Response.json({ code: "stale", value: set.value }, { status: 409, headers: NO_STORE });
    }
    if (input.action === "save") {
      const saved = await privately("garrison.save", () => saveGarrison(db, access, input, now));
      if (!saved.ok) return privateError(STATUS[saved.code], saved.code);
      const body = Response.json({ ok: true, rev: saved.rev }, { headers: NO_STORE });
      return counted(ctx, access, "garrison", "save", body);
    }
    const language = pickWorkspaceLanguage(
      jar.get(WORKSPACE_LANG_COOKIE)?.value,
      request.headers.get("accept-language"),
    );
    const posted = await privately("garrison.post", async () =>
      postGarrison(db, access, input, {
        fetch: ctx.fetch,
        now,
        channels: await noticeChannels(db, access, ctx.env),
        t: WORKSPACE_DICTIONARIES[language],
        language,
      }),
    );
    if (!posted.ok) return privateError(STATUS[posted.code], posted.code);
    const body = Response.json({ ok: true, at: posted.at, rev: posted.rev }, { headers: NO_STORE });
    return counted(ctx, access, "garrison", "publish", body);
  });
}
