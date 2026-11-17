// POST /api/discord/interactions — the Discord app's Interactions Endpoint URL (D96): the "Apps → Send to
// LAPTracker" message command and Discord's PING. Public, outside /w: Discord signs each request with
// Ed25519 and the handler refuses any other. It answers within Discord's 3 s with a reply only the sender
// sees, then reads the pictures after the response (`after`) and edits that reply.
import { after } from "next/server";

import { handleInteraction } from "@/lib/private/discord-interaction";
import { NO_STORE, privateError } from "@/lib/private/http";
import { runJob } from "@/lib/private/import-discord";
import { openOcr } from "@/lib/private/import-read";
import { withContext } from "@/lib/route";

/** The reading after the response: fetch, OCR, drafts and the reply's edit. */
export const maxDuration = 60;
/** An interaction with its resolved message is a few KB; anything this large is not Discord's. */
const MAX_BODY = 256 * 1024;

export async function POST(request: Request): Promise<Response> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) {
    return privateError(413, "too_large");
  }
  const body = await request.text();
  if (body.length > MAX_BODY) return privateError(413, "too_large");
  return withContext("/api/discord/interactions", async (ctx, db) => {
    const handled = await handleInteraction(
      db,
      ctx.env.DISCORD_PUBLIC_KEY,
      {
        body,
        signature: request.headers.get("x-signature-ed25519"),
        timestamp: request.headers.get("x-signature-timestamp"),
      },
      ctx.now(),
    );
    if (handled.status === 200 && handled.job) {
      const job = handled.job;
      const deps = {
        openDb: ctx.openDb,
        fetch: ctx.fetch,
        openReader: openOcr,
        discordBase: ctx.env.DISCORD_API_BASE_URL,
        origin: new URL(request.url).origin,
        serverTz: ctx.env.SERVER_TZ,
        now: ctx.now,
      };
      after(() => runJob(deps, job));
    }
    return Response.json(handled.body, { status: handled.status, headers: NO_STORE });
  });
}
