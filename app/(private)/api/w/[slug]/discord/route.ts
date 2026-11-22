// POST /api/w/[slug]/discord — Alliance settings → Discord (D129, issue 451). Officers only: same origin, JSON,
// an officer's session (a member's answers 401 signed_out, D99).
//   {action: "check"}                                         the bot in the server, then the commands that are on
//   {action: "webhook", channel, url, name, forum, requestId} save or replace a channel's webhook (D100)
//   {action: "remove_webhook", channel}                       remove it
//   {action: "test", channel}                                 "Send a test message"
// The server is always the workspace's own. No answer carries a webhook URL or the bot token: only states,
// channel names and command names. Each write that went through counts as `ws_action` `discord`.
import { requireWorkspace } from "@/lib/private/access";
import { WORKSPACE_LANG_COOKIE } from "@/lib/private/cookies";
import { withActionEvent } from "@/lib/private/desk-action";
import { WORKSPACE_DICTIONARIES, pickWorkspaceLanguage } from "@/lib/private/dictionary";
import { checkBot } from "@/lib/private/discord-setup";
import {
  discordInput,
  removeWebhook,
  saveWebhook,
  testWebhook,
  type WebhookView,
} from "@/lib/private/discord-webhooks";
import { isSameOriginJson, NO_STORE, privateError, requestCookies } from "@/lib/private/http";
import { SLUG } from "@/lib/private/sign-in";
import { withContext } from "@/lib/route";

const STATUS = {
  bot_off: 503,
  off: 503,
  rate_limited: 429,
  bot_missing: 409,
  unreachable: 503,
  commands_failed: 502,
  refused: 422,
  wrong_server: 422,
  not_set_up: 409,
  failed: 502,
} as const;

/** Only what the page shows: each channel's state and name. */
const channels = (views: WebhookView[]) =>
  Response.json(
    { channels: views.map((v) => ({ channel: v.channel, state: v.state, name: v.name })) },
    { headers: NO_STORE },
  );

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  if (!SLUG.test(slug)) return privateError(404, "not_found");
  if (!isSameOriginJson(request)) return privateError(403, "forbidden");
  const parsed = discordInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return privateError(400, "bad_request");
  const input = parsed.data;
  return withContext("/api/w/[slug]/discord", slug, async (ctx, db) => {
    const now = ctx.now();
    const jar = requestCookies(request);
    const access = await requireWorkspace(db, slug, jar, now);
    if (!access.ok) return privateError(401, "signed_out");
    const deps = { env: ctx.env, fetch: ctx.fetch, now };
    if (input.action === "check") {
      const checked = await checkBot(db, access, deps);
      if (checked.ok) {
        const body = { firstSeen: checked.firstSeen, commands: checked.commands };
        return withActionEvent(
          ctx,
          access,
          "discord",
          "check",
          Response.json(body, { headers: NO_STORE }),
        );
      }
      const firstSeen = "firstSeen" in checked ? { firstSeen: checked.firstSeen } : {};
      const body = { code: checked.code, ...firstSeen };
      return Response.json(body, { status: STATUS[checked.code], headers: NO_STORE });
    }
    if (input.action === "remove_webhook") {
      const views = await removeWebhook(db, access, ctx.env, input.channel);
      return withActionEvent(ctx, access, "discord", "delete", channels(views));
    }
    if (input.action === "test") {
      const language = pickWorkspaceLanguage(
        jar.get(WORKSPACE_LANG_COOKIE)?.value,
        request.headers.get("accept-language"),
      );
      const t = WORKSPACE_DICTIONARIES[language];
      const words = { title: t["discord.test.title"], text: t[`discord.test.${input.channel}`] };
      const tested = await testWebhook(
        db,
        access,
        { ...deps, ...words, report: ctx.report },
        input.channel,
      );
      if (!tested.ok) return privateError(STATUS[tested.code], tested.code);
      const body = Response.json({ ok: true }, { headers: NO_STORE });
      return withActionEvent(ctx, access, "discord", "test", body);
    }
    const saved = await saveWebhook(db, access, deps, input);
    if (!saved.ok) return privateError(STATUS[saved.code], saved.code);
    return withActionEvent(ctx, access, "discord", "save", channels(saved.views));
  });
}
