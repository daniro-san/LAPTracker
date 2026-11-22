// POST /api/discord/interactions — the Discord app's Interactions Endpoint URL (D96): the "Apps → Send to
// LAPTracker" message command, the two Translate commands and their picker (D101), and Discord's PING. Public, outside /w: Discord signs each request with
// Ed25519 and the handler refuses any other. It answers within Discord's 3 s with a reply only the sender
// sees, then reads the pictures after the response (`after`) and edits that reply.
import { after } from "next/server";

import { captureServer, eventWorkspace, type ServerEvent } from "@/lib/analytics/server";
import { handleInteraction, type Handled } from "@/lib/private/discord-interaction";
import { runTranslation } from "@/lib/private/discord-translate-run";
import { NO_STORE, privateError } from "@/lib/private/http";
import { runJob } from "@/lib/private/import-discord";
import { openOcr } from "@/lib/private/import-read";
import { withContext } from "@/lib/route";

/**
 * The work after the response: the reading (fetch, OCR, drafts, the reply's edit; it stops at 45 s), or a
 * translation, which at worst is four model calls of 15 s (D81) and the posts.
 */
export const maxDuration = 90;
/** An interaction with its resolved message is a few KB; anything this large is not Discord's. */
const MAX_BODY = 256 * 1024;

/**
 * D115: which command, nothing about the message or the sender; issue 452: the server's workspace and
 * alliance tag, never its guild id. Null when no command was accepted.
 */
function commandUsed(handled: Handled): ServerEvent | null {
  if (handled.status !== 200) return null;
  const event = "discord_command_used";
  if (handled.job) {
    const where = eventWorkspace(handled.job.access);
    return { event, properties: { command: "send_to_laptracker" }, where };
  }
  const translation = handled.translation;
  if (!translation) return null;
  const where = translation.workspace;
  return {
    event,
    properties: { command: `translate_for_${translation.mode}` },
    ...(where && { where }),
  };
}

export async function POST(request: Request): Promise<Response> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) {
    return privateError(413, "too_large");
  }
  const body = await request.text();
  if (body.length > MAX_BODY) return privateError(413, "too_large");
  return withContext("/api/discord/interactions", async (ctx, db) => {
    const origin = new URL(request.url).origin;
    const handled = await handleInteraction(
      db,
      ctx.env.DISCORD_PUBLIC_KEY,
      {
        body,
        signature: request.headers.get("x-signature-ed25519"),
        timestamp: request.headers.get("x-signature-timestamp"),
      },
      ctx.now(),
      origin,
      Boolean(ctx.env.DISCORD_BOT_TOKEN),
    );
    const used = commandUsed(handled);
    if (used) after(() => captureServer(ctx.env, ctx.fetch, [used]));
    if (handled.status === 200 && handled.job) {
      const job = handled.job;
      const deps = {
        openDb: ctx.openDb,
        fetch: ctx.fetch,
        openReader: openOcr,
        discordBase: ctx.env.DISCORD_API_BASE_URL,
        origin,
        serverTz: ctx.env.SERVER_TZ,
        now: ctx.now,
        report: ctx.report,
      };
      after(() => runJob(deps, job));
    }
    if (handled.status === 200 && handled.translation) {
      const job = handled.translation;
      const deps = {
        // Issue 452: each `$ai_generation` says which workspace's server asked.
        ai: ctx.ai?.(job.workspace) ?? null,
        fetch: ctx.fetch,
        discordBase: ctx.env.DISCORD_API_BASE_URL,
        botToken: ctx.env.DISCORD_BOT_TOKEN,
        now: ctx.now,
      };
      after(() => runTranslation(deps, job));
    }
    return Response.json(handled.body, { status: handled.status, headers: NO_STORE });
  });
}
