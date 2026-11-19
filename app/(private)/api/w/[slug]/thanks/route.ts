// POST /api/w/[slug]/thanks — "Share the thanks" (issue 404, D114). Officers only (401 signed_out, D99).
//   {action: "share", target: "discord" | "board", week, title, texts, names, requestId}: once per request
//     id (D100). Discord: the members' channel of WORKSPACE_DISCORD_WEBHOOKS (D102), no mentions; codes
//     not_set_up (no members channel), posting (the same request is still running), recent (the same
//     week went to the same place in the last 30 s), failed (Discord refused or timed out). Board: the
//     card members see until the next thanks or a Take down.
//   {action: "take_down", id}: hides the board's card; not_found for another workspace's or a Discord share.
import { requireWorkspace } from "@/lib/private/access";
import { counted } from "@/lib/private/desk-action";
import {
  isSameOriginJson,
  NO_STORE,
  privately,
  privateError,
  requestCookies,
} from "@/lib/private/http";
import { noticeChannels } from "@/lib/private/notice-publish";
import { SLUG } from "@/lib/private/sign-in";
import { shareThanks, takeDownThanks, thanksInput } from "@/lib/private/thanks";
import { withContext } from "@/lib/route";

import { LANGUAGE_NAME } from "../../../../_ui/languages";

const STATUS = { not_set_up: 409, posting: 409, recent: 409, failed: 502 } as const;

/** Discord's messages have the notices' 5 s each within a 40 s budget (D102). */
export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = thanksInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  return withContext("/api/w/[slug]/thanks", slug, async (ctx, db) => {
    const now = ctx.now();
    const access = await requireWorkspace(db, slug, requestCookies(request), now);
    if (!access.ok) return privateError(401, "signed_out");
    const ask = parsed.data;
    if (ask.action === "take_down") {
      const done = await takeDownThanks(db, access, ask.id, now);
      return done
        ? counted(
            ctx,
            access,
            "thanks",
            "take_down",
            Response.json({ ok: true }, { headers: NO_STORE }),
          )
        : privateError(404, "not_found");
    }
    const result = await privately("thanks.share", () =>
      shareThanks(db, access, ask, {
        fetch: ctx.fetch,
        now,
        channels: noticeChannels(ctx.env, slug),
        names: LANGUAGE_NAME,
      }),
    );
    if (!result.ok) return privateError(STATUS[result.code], result.code);
    const { id, target, at } = result.row;
    return counted(
      ctx,
      access,
      "thanks",
      "share",
      Response.json({ id, target, at }, { headers: NO_STORE }),
    );
  });
}
