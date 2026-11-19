// POST /api/w/[slug]/follow-up — an officer records what happened with a member on the week's list (issue
// 340, D104): "Talked to them", On a break until a day, Needs help or "All fine", with a short note and the
// sheet's request id (D100). Same origin and JSON only (D71), zod-parsed, a session of this workspace (401
// signed_out, D99). On a break and Needs help go through the member facts (D80): another officer's newer
// value answers 409 with it in the officer's words. The lib call runs in `privately`; nothing is logged.
import { z } from "zod";

import { fill, isolate } from "@/lib/copy";
import { requireWorkspace } from "@/lib/private/access";
import { isDay } from "@/lib/private/calendar-time";
import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import { counted } from "@/lib/private/desk-action";
import { pickWorkspaceLanguage, WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import type { FactValues } from "@/lib/private/fact-fields";
import { factText } from "@/lib/private/fact-text";
import { recordFollowUp, undoFollowUp } from "@/lib/private/follow-up";
import { FOLLOW_UP_ACTIONS } from "@/lib/private/follow-up-rules";
import {
  isSameOriginJson,
  NO_STORE,
  privateError,
  privately,
  requestCookies,
} from "@/lib/private/http";
import { cardFormats } from "@/lib/private/member-card";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const uid = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const record = z
  .object({
    uid,
    action: z.enum(FOLLOW_UP_ACTIONS),
    note: z.string().max(500),
    until: z.string().refine(isDay).nullable(),
    version: z.number().int().min(0),
    requestId: z.uuid(),
  })
  .strict();
/** Undo: `target` is the request id of the record to withdraw. */
const undo = z
  .object({ uid, action: z.literal("undo"), target: z.uuid(), requestId: z.uuid() })
  .strict();
const body = z.union([record, undo]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const jar = requestCookies(request);
  return withContext("/api/w/[slug]/follow-up", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, jar, now);
    if (!access.ok) return privateError(401, "signed_out");
    const zone = ctx.env.SERVER_TZ;
    const input = parsed.data;
    const result = await privately(
      `follow_up.${input.action === "undo" ? "undo" : "record"}`,
      () =>
        input.action === "undo"
          ? undoFollowUp(db, access, input, { now, zone })
          : recordFollowUp(db, access, input, { now, zone }),
    );
    if (result.ok) {
      const done = Response.json({ ok: true }, { headers: NO_STORE });
      return counted(ctx, access, "follow_up", input.action === "undo" ? "undo" : "record", done);
    }
    if (result.code === "not_found") return privateError(409, result.code);
    if (result.code !== "stale") return privateError(400, result.code);
    const language = pickWorkspaceLanguage(
      jar.get(WORKSPACE_LANG_COOKIE)?.value,
      request.headers.get("accept-language"),
    );
    const t = WORKSPACE_DICTIONARIES[language];
    // The same date format as the page and the member card ("Tue, Nov 17").
    const f = cardFormats(language, zone, now);
    const value = factText(result.field, result.value as FactValues[typeof result.field] | null, {
      language,
      now,
      day: (iso) => f.date(iso),
      words: t,
    });
    const said = result.by
      ? fill(t["followup.staleBy"], { who: isolate(result.by), value })
      : fill(t["followup.stale"], { value });
    return Response.json(
      { code: "stale", version: result.version, said },
      { status: 409, headers: NO_STORE },
    );
  });
}
