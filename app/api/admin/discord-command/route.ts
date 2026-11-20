// POST /api/admin/discord-command — /admin's "Register the Discord command" (D96): registers the app's message
// commands (D101) in the Discord server of every workspace, only those whose feature is on there (D129), with
// the app's credentials from the server's env, and records what each server took.
// PIN only. The answer is each guild id with Discord's HTTP status, or a code: never the secret or token.
import { authorize } from "@/lib/auth";
import { errorResponse, withContext } from "@/lib/route";
import { syncCommands } from "@/lib/workspace-commands";

export function POST(request: Request): Promise<Response> {
  return withContext("/api/admin/discord-command", async (ctx, db) => {
    const auth = await authorize(request.headers, db, ctx, { cron: false, pin: true });
    if (!auth.ok) return errorResponse(auth.status, auth.code);
    const deps = { env: ctx.env, fetch: ctx.fetch, now: ctx.now() };
    const result = await syncCommands(db, deps, {});
    if (!result.ok) {
      return result.code === "no_credentials"
        ? errorResponse(503, result.code)
        : Response.json({ code: result.code, status: result.status }, { status: 502 });
    }
    return Response.json({
      guilds: result.guilds.map((g) => ({ guild_id: g.guildId, status: g.status })),
    });
  });
}
