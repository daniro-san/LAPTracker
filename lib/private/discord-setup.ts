// Alliance settings → Discord (D129, issue 451): the link that adds the bot to the workspace's own server, and
// "Check", which asks Discord with the bot token whether the bot is in that server and then registers the
// message commands that are on (lib/workspace-commands.ts). Every function takes a WorkspaceAccess, so the
// server is always the workspace's own, never one from a request. The bot token is sent only to Discord.
import { commandsFor } from "../app-commands";
import type { Db } from "../db";
import type { Env } from "../env";
import { recordFailure } from "../repo/auth-attempts";
import { setDiscordIconHash } from "../repo/workspace-branding";
import { discordState, markBotSeen } from "../repo/workspace-discord";
import { findWorkspaceBySlug } from "../repo/workspaces";
import { ICON_HASH } from "../workspace-branding";
import { syncCommands } from "../workspace-commands";
import type { WorkspaceAccess } from "./access";

/**
 * What the bot may do (D101): View Channels (1024), Send Messages (2048), Create Public Threads
 * (34359738368) and Send Messages in Threads (274877906944); issue 868: Manage Roles (268435456), to give
 * the member role below its own when an officer approves a `/join`. No admin right.
 */
export const BOT_PERMISSIONS = "309506083840";

/** At most 5 checks every 15 minutes per workspace: each makes up to three Discord calls (owner's call, 2026-11-20). */
export const CHECKS = 5;
export const CHECK_WINDOW_MS = 15 * 60_000;
const TIMEOUT_MS = 10_000;

type DiscordEnv = Pick<
  Env,
  "DISCORD_CLIENT_ID" | "DISCORD_CLIENT_SECRET" | "DISCORD_API_BASE_URL" | "DISCORD_BOT_TOKEN"
>;

const base = (env: DiscordEnv) => env.DISCORD_API_BASE_URL.replace(/\/$/, "");

/** Check can run: the bot token and the app's credentials are set. */
const ready = (env: DiscordEnv) =>
  Boolean(env.DISCORD_BOT_TOKEN && env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET);

/**
 * Discord's install page for this workspace's server only (`guild_id` with `disable_guild_select`), or null
 * while the app's id is not set. The client id is public.
 */
export function installUrl(
  env: DiscordEnv,
  guildId: string,
  permissions: string = BOT_PERMISSIONS,
): string | null {
  if (!env.DISCORD_CLIENT_ID) return null;
  const query = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    scope: "bot applications.commands",
    permissions,
    guild_id: guildId,
    disable_guild_select: "true",
  });
  return `${base(env)}/oauth2/authorize?${query}`;
}

export interface BotView {
  /** The install link, or null: the site has no Discord app set up. */
  installUrl: string | null;
  /** Whether "Check" can run: the bot token and the app's credentials are set. */
  ready: boolean;
  botSeenAt: Date | null;
  /** The commands last registered in the server (null: never); `wanted`: those on now. */
  commands: string[] | null;
  wanted: string[];
  /** Issue 868: `/join` is on for the alliance, and the member role an approved request gets (null: none). */
  join: boolean;
  memberRole: string | null;
}

export async function botView(db: Db, access: WorkspaceAccess, env: DiscordEnv): Promise<BotView> {
  const [workspace, state] = await Promise.all([
    findWorkspaceBySlug(db, access.slug),
    discordState(db, access.workspaceId),
  ]);
  return {
    installUrl: workspace ? installUrl(env, workspace.discordGuildId) : null,
    ready: ready(env),
    botSeenAt: state.botSeenAt,
    commands: state.commands,
    wanted: commandsFor(access.features.on).map((c) => c.name),
    join: access.features.on.has("discord_join"),
    memberRole: state.memberRoleId ? (state.memberRoleName ?? "") : null,
  };
}

/**
 * bot_off: no bot token or app credentials on this site. rate_limited: past CHECKS in the window. bot_missing:
 * Discord says the bot is not in the server. unreachable: no clear answer. commands_failed: the bot is in,
 * but Discord refused the commands.
 */
export type CheckResult =
  | { ok: true; firstSeen: boolean; commands: string[] }
  | { ok: false; code: "bot_off" | "rate_limited" | "bot_missing" | "unreachable" }
  | { ok: false; code: "commands_failed"; firstSeen: boolean };

/**
 * Whether the bot is in the server: Discord answers a guild read only for a member bot. When it is, the
 * server's icon hash comes with it (issue 462: the Branding card's Discord icon); null when it has none.
 */
export async function botIn(
  env: Pick<DiscordEnv, "DISCORD_API_BASE_URL" | "DISCORD_BOT_TOKEN">,
  doFetch: typeof fetch,
  guildId: string,
): Promise<{ state: "in"; icon: string | null } | { state: "missing" | "unreachable" }> {
  const res = await doFetch(`${base(env)}/guilds/${guildId}`, {
    headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
  if (res?.ok) {
    const body = (await res.json().catch(() => null)) as { icon?: unknown } | null;
    const icon = typeof body?.icon === "string" && ICON_HASH.test(body.icon) ? body.icon : null;
    return { state: "in", icon };
  }
  // 403 Missing Access or 404 Unknown Guild: the bot is not in that server.
  return { state: res?.status === 403 || res?.status === 404 ? "missing" : "unreachable" };
}

/** "Check": the bot in the workspace's server, then its commands registered (only those turned on). */
export async function checkBot(
  db: Db,
  access: WorkspaceAccess,
  deps: { env: DiscordEnv; fetch: typeof fetch; now: Date },
): Promise<CheckResult> {
  const { env, now } = deps;
  if (!ready(env)) return { ok: false, code: "bot_off" };
  const tries = await recordFailure(db, `botcheck:ws:${access.workspaceId}`, CHECK_WINDOW_MS, now);
  if (tries > CHECKS) return { ok: false, code: "rate_limited" };
  const workspace = await findWorkspaceBySlug(db, access.slug);
  if (!workspace) return { ok: false, code: "unreachable" };
  const found = await botIn(env, deps.fetch, workspace.discordGuildId);
  if (found.state !== "in")
    return { ok: false, code: found.state === "missing" ? "bot_missing" : "unreachable" };
  await setDiscordIconHash(db, access.workspaceId, found.icon);
  const firstSeen = await markBotSeen(db, access.workspaceId, now);
  const registered = await syncCommands(db, deps, { only: [access.workspaceId] });
  const status = registered.ok ? (registered.guilds[0]?.status ?? 0) : 0;
  if (status < 200 || status >= 300) return { ok: false, code: "commands_failed", firstSeen };
  return { ok: true, firstSeen, commands: commandsFor(access.features.on).map((c) => c.name) };
}
