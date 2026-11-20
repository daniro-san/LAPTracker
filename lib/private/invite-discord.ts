// The invite's Discord calls (D130, issue 453). With the invited person's sign-in token, once: which servers
// they may pick (they own it, or Discord gives them Manage Server). With the bot token: the server's roles
// (which also says whether the bot is in), and, only after she allowed Manage Roles, creating the two roles and
// giving her the leadership one. Answers are parsed here; the bot token goes only to Discord.
import { z } from "zod";

import type { Env } from "../env";
import type { InviteGuild } from "../schema-invites";
import { BOT_PERMISSIONS } from "./discord-setup";

/** D101's bot permissions plus Manage Roles (268435456): only the "create the roles" link asks for it. */
export const ROLES_PERMISSIONS = String(BigInt(BOT_PERMISSIONS) | (1n << 28n));
const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;
const TIMEOUT_MS = 10_000;
/** A server list longer than this is cut: nobody manages more alliances' servers. */
const MAX_GUILDS = 200;

type BotEnv = Pick<Env, "DISCORD_API_BASE_URL" | "DISCORD_BOT_TOKEN">;

const guildSchema = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  name: z.string(),
  owner: z.boolean().optional(),
  permissions: z.string().regex(/^\d+$/).optional(),
});

/** The servers of `/users/@me/guilds` the account owns or may manage, by name. */
export function manageable(body: unknown): InviteGuild[] | null {
  const parsed = z.array(guildSchema).safeParse(body);
  if (!parsed.success) return null;
  return parsed.data
    .filter((g) => {
      const bits = BigInt(g.permissions ?? "0");
      return g.owner === true || (bits & (ADMINISTRATOR | MANAGE_GUILD)) !== 0n;
    })
    .slice(0, MAX_GUILDS)
    .map((g) => ({ id: g.id, name: g.name.slice(0, 100) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface GuildRole {
  id: string;
  name: string;
  /** Discord's colour as a number; 0: none. */
  color: number;
}

const roleSchema = z.object({
  id: z.string().regex(/^\d{17,20}$/),
  name: z.string(),
  color: z.number().int().nonnegative(),
  position: z.number().int(),
  managed: z.boolean().optional(),
});

const base = (env: BotEnv) => env.DISCORD_API_BASE_URL.replace(/\/$/, "");

function bot(env: BotEnv, doFetch: typeof fetch, path: string, init: RequestInit = {}) {
  return doFetch(`${base(env)}${path}`, {
    ...init,
    headers: {
      authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      ...(init.body && { "content-type": "application/json" }),
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
}

/**
 * The server's roles a person can hold, highest first: not @everyone (its id is the server's) and not a
 * bot's own role. 403 or 404: the bot is not in the server.
 */
export async function guildRoles(
  env: BotEnv,
  doFetch: typeof fetch,
  guildId: string,
): Promise<{ ok: true; roles: GuildRole[] } | { ok: false; code: "bot_missing" | "unreachable" }> {
  const res = await bot(env, doFetch, `/guilds/${guildId}/roles`);
  if (res?.status === 403 || res?.status === 404) return { ok: false, code: "bot_missing" };
  const parsed = z.array(roleSchema).safeParse(res?.ok ? await res.json().catch(() => null) : null);
  if (!parsed.success) return { ok: false, code: "unreachable" };
  const roles = parsed.data
    .filter((r) => r.id !== guildId && !r.managed)
    .sort((a, b) => b.position - a.position)
    .map(({ id, name, color }) => ({ id, name, color }));
  return { ok: true, roles };
}

/** A new role with no permissions of its own. 403: the bot may not manage roles there. */
export async function createRole(
  env: BotEnv,
  doFetch: typeof fetch,
  guildId: string,
  name: string,
): Promise<{ ok: true; role: GuildRole } | { ok: false; code: "no_permission" | "unreachable" }> {
  const body = JSON.stringify({ name, permissions: "0", mentionable: false, hoist: false });
  const res = await bot(env, doFetch, `/guilds/${guildId}/roles`, { method: "POST", body });
  if (res?.status === 403) return { ok: false, code: "no_permission" };
  const parsed = roleSchema.safeParse(res?.ok ? await res.json().catch(() => null) : null);
  if (!parsed.success) return { ok: false, code: "unreachable" };
  const { id, color } = parsed.data;
  return { ok: true, role: { id, name: parsed.data.name, color } };
}

/**
 * "Give me the leadership role": the bot can give only roles below its own. 403: below it or no Manage
 * Roles; 404: the account is not in the server.
 */
export async function giveRole(
  env: BotEnv,
  doFetch: typeof fetch,
  target: { guildId: string; userId: string; roleId: string },
): Promise<"ok" | "refused" | "unreachable"> {
  const path = `/guilds/${target.guildId}/members/${target.userId}/roles/${target.roleId}`;
  const res = await bot(env, doFetch, path, { method: "PUT" });
  if (res?.ok) return "ok";
  return res?.status === 403 || res?.status === 404 ? "refused" : "unreachable";
}
