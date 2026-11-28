// Alliance settings → Discord → Member role (issue 868): the role the bot gives a member when an officer approves
// their `/join` request. Discord lets a bot give only roles below its own highest role, and only with Manage
// Roles, so the list officers pick from, and the save, are both checked with Discord with the bot token: the
// server's roles below the bot's highest, never @everyone or a role an integration manages. Every function
// takes a WorkspaceAccess, so the server is always the workspace's own. The bot token goes only to Discord.
import { z } from "zod";

import type { Db } from "../db";
import type { Env } from "../env";
import { recordFailure } from "../repo/auth-attempts";
import { discordState, saveMemberRole } from "../repo/workspace-discord";
import { findWorkspaceBySlug } from "../repo/workspaces";
import type { WorkspaceAccess } from "./access";

type RoleEnv = Pick<Env, "DISCORD_API_BASE_URL" | "DISCORD_BOT_TOKEN" | "DISCORD_CLIENT_ID">;
export interface RoleDeps {
  env: RoleEnv;
  fetch: typeof fetch;
  now: Date;
}

/** At most 10 role reads or saves every 15 minutes per workspace: each is two Discord calls. */
export const ROLE_TRIES = 10;
const WINDOW_MS = 15 * 60_000;
const TIMEOUT_MS = 10_000;

/** A role id as officers send it back: a Discord id. */
export const roleId = z.string().regex(/^\d{17,20}$/);

const rolesSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    position: z.number(),
    /** The role's permission bits, as Discord sends them (a decimal string). */
    permissions: z.string().regex(/^\d+$/),
    managed: z.boolean().optional(),
  }),
);

/**
 * Permissions a role handed to anyone approved must never carry: Kick Members, Ban Members, Administrator,
 * Manage Channels, Manage Server, Mention Everyone, Manage Roles and Manage Webhooks.
 */
const POWERFUL =
  (1n << 1n) |
  (1n << 2n) |
  (1n << 3n) |
  (1n << 4n) |
  (1n << 5n) |
  (1n << 17n) |
  (1n << 28n) |
  (1n << 29n);
const memberSchema = z.object({ roles: z.array(z.string()) });

export interface Role {
  id: string;
  name: string;
}

export type RolesResult =
  | { ok: true; roles: Role[] }
  | { ok: false; code: "bot_off" | "rate_limited" | "bot_missing" | "unreachable" };

const base = (env: RoleEnv) => env.DISCORD_API_BASE_URL.replace(/\/$/, "");

function botGet(deps: Omit<RoleDeps, "now">, path: string) {
  return deps
    .fetch(`${base(deps.env)}${path}`, {
      headers: { authorization: `Bot ${deps.env.DISCORD_BOT_TOKEN}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    .catch(() => null);
}

/**
 * The server's roles the bot may give, highest first: below the bot's own highest role (the bot's user id is
 * the app's id), less @everyone (its id is the server's), roles an integration manages, the workspace's
 * leadership roles (holding one makes a person an officer on the desk, D71) and roles with a POWERFUL
 * permission. Read again before every give, since the role or its permissions may have changed since saved.
 */
export async function givableRoles(
  deps: Omit<RoleDeps, "now">,
  workspace: { discordGuildId: string; leaderRoleIds: readonly string[] },
): Promise<RolesResult> {
  const guildId = workspace.discordGuildId;
  const [rolesRes, botRes] = await Promise.all([
    botGet(deps, `/guilds/${guildId}/roles`),
    botGet(deps, `/guilds/${guildId}/members/${deps.env.DISCORD_CLIENT_ID}`),
  ]);
  if ([rolesRes, botRes].some((r) => r?.status === 403 || r?.status === 404))
    return { ok: false, code: "bot_missing" };
  const roles = rolesRes?.ok
    ? rolesSchema.safeParse(await rolesRes.json().catch(() => null))
    : null;
  const bot = botRes?.ok ? memberSchema.safeParse(await botRes.json().catch(() => null)) : null;
  if (!roles?.success || !bot?.success) return { ok: false, code: "unreachable" };
  const top = Math.max(
    0,
    ...roles.data.filter((r) => bot.data.roles.includes(r.id)).map((r) => r.position),
  );
  const below = roles.data
    .filter(
      (r) =>
        r.position < top &&
        r.id !== guildId &&
        !r.managed &&
        !workspace.leaderRoleIds.includes(r.id) &&
        (BigInt(r.permissions) & POWERFUL) === 0n,
    )
    .sort((a, b) => b.position - a.position)
    .map((r) => ({ id: r.id, name: r.name }));
  return { ok: true, roles: below };
}

/** The workspace's server, after the per-workspace limit; or why not. */
async function guildOf(
  db: Db,
  access: WorkspaceAccess,
  deps: RoleDeps,
): Promise<
  | { workspace: { discordGuildId: string; leaderRoleIds: string[] } }
  | { code: "bot_off" | "rate_limited" | "unreachable" }
> {
  if (!deps.env.DISCORD_BOT_TOKEN || !deps.env.DISCORD_CLIENT_ID) return { code: "bot_off" };
  const tries = await recordFailure(db, `memberrole:ws:${access.workspaceId}`, WINDOW_MS, deps.now);
  if (tries > ROLE_TRIES) return { code: "rate_limited" };
  const workspace = await findWorkspaceBySlug(db, access.slug);
  return workspace ? { workspace } : { code: "unreachable" };
}

/** "Choose a role": the roles the bot may give in the workspace's server. */
export async function memberRoleChoices(
  db: Db,
  access: WorkspaceAccess,
  deps: RoleDeps,
): Promise<RolesResult> {
  const found = await guildOf(db, access, deps);
  if ("code" in found) return { ok: false, code: found.code };
  return givableRoles(deps, found.workspace);
}

export type SaveRoleResult =
  | { ok: true; role: Role }
  | { ok: false; code: Extract<RolesResult, { ok: false }>["code"] | "not_below" };

/**
 * INVARIANT discord.role-below-bot: a role is saved only when Discord says, at save time, that it is one the
 * bot may give in the workspace's own server and it is neither a leadership role nor one with a POWERFUL
 * permission (`givableRoles`). Any other id ("not_below") is never stored.
 */
export async function chooseMemberRole(
  db: Db,
  access: WorkspaceAccess,
  deps: RoleDeps,
  id: string,
): Promise<SaveRoleResult> {
  const choices = await memberRoleChoices(db, access, deps);
  if (!choices.ok) return choices;
  const role = choices.roles.find((r) => r.id === id);
  if (!role) return { ok: false, code: "not_below" };
  await saveMemberRole(db, access.workspaceId, role);
  return { ok: true, role };
}

/** "Remove": approved members get no role. */
export async function removeMemberRole(db: Db, access: WorkspaceAccess): Promise<void> {
  await saveMemberRole(db, access.workspaceId, null);
}

/** The role chosen for the workspace, for the settings card; null when none. */
export async function memberRoleOf(db: Db, access: WorkspaceAccess): Promise<Role | null> {
  const state = await discordState(db, access.workspaceId);
  return state.memberRoleId ? { id: state.memberRoleId, name: state.memberRoleName ?? "" } : null;
}

/**
 * Gives `roleId` to the Discord user in the server (an officer's Approve, issue 868). "given" on Discord's
 * 204; "failed" on any refusal or no answer (the role moved above the bot, Manage Roles was taken away, the
 * person left the server). The answer carries only that.
 */
export async function giveMemberRole(
  deps: Omit<RoleDeps, "now">,
  guildId: string,
  userId: string,
  role: string,
): Promise<"given" | "failed"> {
  const res = await deps
    .fetch(`${base(deps.env)}/guilds/${guildId}/members/${userId}/roles/${role}`, {
      method: "PUT",
      headers: { authorization: `Bot ${deps.env.DISCORD_BOT_TOKEN}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    .catch(() => null);
  return res?.ok ? "given" : "failed";
}
