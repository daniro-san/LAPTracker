// The invite's steps after sign-in (D130, issue 453): pick the server, read its roles through the bot, create
// the two roles (only after she allowed Manage Roles), and finish: the workspace is made with her as its first
// officer, the commands that are on are registered in her server, and she is signed in. Each step needs the
// open invite and this browser's claim (lib/private/invite.ts); the server is always one Discord listed for
// her account, never a workspace's that exists (D126), and the alliance is always the invite's own.
import { z } from "zod";

import type { Db } from "../db";
import type { Env } from "../env";
import {
  createInvitedWorkspace,
  pickGuild,
  takenWorkspaceKeys,
  type InviteRow,
} from "../repo/alliance-invites";
import { recordFailure } from "../repo/auth-attempts";
import { markBotSeen } from "../repo/workspace-discord";
import { WORKSPACE_SLUG } from "../repo/workspaces";
import { syncCommands } from "../workspace-commands";
import {
  allianceOf,
  claimed,
  closedWhy,
  INVITE_COOKIE,
  inviteFrom,
  type CookieJar,
} from "./invite";
import { createRole, giveRole, guildRoles, type GuildRole } from "./invite-discord";
import { privateLog } from "./log";
import { createSession } from "./session";

const snowflake = z.string().regex(/^\d{17,20}$/);
const roleName = z.string().trim().min(1).max(100);

export const inviteInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("server"), guild_id: snowflake }).strict(),
  z.object({ action: z.literal("roles") }).strict(),
  z
    .object({
      action: z.literal("create_roles"),
      leader: roleName,
      member: roleName.nullable(),
      give_me: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("finish"),
      leader_role_ids: z.array(snowflake).min(1).max(20),
      member_role_ids: z.array(snowflake).max(20),
    })
    .strict(),
]);
export type InviteInput = z.infer<typeof inviteInput>;

/** At most 30 steps every 15 minutes per invite: each may make up to three Discord calls. */
export const STEPS = 30;
const STEP_WINDOW_MS = 15 * 60_000;

export type StepDeps = {
  env: Pick<
    Env,
    "DISCORD_CLIENT_ID" | "DISCORD_CLIENT_SECRET" | "DISCORD_API_BASE_URL" | "DISCORD_BOT_TOKEN"
  >;
  fetch: typeof fetch;
  now: Date;
};

export type StepCode =
  | "signed_out"
  | "closed"
  | "rate_limited"
  | "not_yours"
  | "taken"
  | "has_desk"
  | "no_server"
  | "bot_off"
  | "bot_missing"
  | "no_permission"
  | "bad_role"
  | "unreachable";

export type StepResult =
  | {
      ok: true;
      roles?: GuildRole[];
      gave?: "ok" | "refused" | "unreachable" | null;
      /** The leadership role was made (or found) but Discord refused the member role. */
      memberFailed?: "no_permission" | "unreachable" | null;
    }
  | { ok: true; slug: string; cookie: string }
  | { ok: false; code: StepCode };

const no = (code: StepCode) => ({ ok: false as const, code });

/** The open invite this browser signed in through, counted against STEPS. */
async function openClaim(
  db: Db,
  jar: CookieJar,
  now: Date,
): Promise<InviteRow | { ok: false; code: StepCode }> {
  const row = await inviteFrom(db, jar.get(INVITE_COOKIE)?.value);
  if (!row || !claimed(row, jar)) return no("signed_out");
  if (closedWhy(row, now)) return no("closed");
  const tries = await recordFailure(db, `invite:${row.id}`, STEP_WINDOW_MS, now);
  return tries > STEPS ? no("rate_limited") : row;
}

export async function inviteStep(
  db: Db,
  deps: StepDeps,
  jar: CookieJar,
  input: InviteInput,
): Promise<StepResult> {
  const row = await openClaim(db, jar, deps.now);
  if (!("id" in row)) return row;
  if (input.action === "server") return chooseServer(db, row, input.guild_id, deps.now);
  if (!row.guildId) return no("no_server");
  if (!deps.env.DISCORD_BOT_TOKEN) return no("bot_off");
  const guildId = row.guildId;
  if (input.action === "roles") return guildRoles(deps.env, deps.fetch, guildId);
  if (input.action === "create_roles") return makeRoles(deps, row, guildId, input);
  return finish(db, deps, { ...row, guildId }, input);
}

/** INVARIANT invite.own-server: only a server Discord listed for her, and never one already taken. */
async function chooseServer(db: Db, row: InviteRow, guildId: string, now: Date) {
  if (!(row.guilds ?? []).some((g) => g.id === guildId)) return no("not_yours");
  const taken = await takenWorkspaceKeys(db);
  if (taken.some((w) => w.guild === guildId)) return no("taken");
  // A second account that signed in meanwhile holds the claim now: this write changes nothing.
  if (!(await pickGuild(db, row.id, claimant(row), guildId, now))) return no("signed_out");
  return { ok: true as const };
}

/** Who the step was checked against: the account and claim of the row read with this browser's cookie. */
const claimant = (row: InviteRow) => ({
  discordId: row.claimedBy ?? "",
  claimHash: row.claimHash ?? "",
});

/** The role of that exact name already in the server (a retry, or one made in Discord), else a new one. */
async function roleNamed(deps: StepDeps, guildId: string, existing: GuildRole[], name: string) {
  const found = existing.find((r) => r.name === name);
  return found
    ? { ok: true as const, role: found }
    : createRole(deps.env, deps.fetch, guildId, name);
}

async function makeRoles(
  deps: StepDeps,
  row: InviteRow,
  guildId: string,
  input: Extract<InviteInput, { action: "create_roles" }>,
): Promise<StepResult> {
  const listed = await guildRoles(deps.env, deps.fetch, guildId);
  if (!listed.ok) return listed;
  const leader = await roleNamed(deps, guildId, listed.roles, input.leader);
  if (!leader.ok) return no(leader.code);
  const member = input.member ? await roleNamed(deps, guildId, listed.roles, input.member) : null;
  const roles = [leader.role, ...(member?.ok ? [member.role] : [])];
  const memberFailed = member && !member.ok ? member.code : null;
  const gave =
    input.give_me && row.claimedBy
      ? await giveRole(deps.env, deps.fetch, {
          guildId,
          userId: row.claimedBy,
          roleId: leader.role.id,
        })
      : null;
  privateLog("w.invite.roles_created", { invite: row.id, roles: roles.length });
  return { ok: true, roles, gave, memberFailed };
}

/** The workspace's address: the tag in lowercase letters and digits, then -2 … -9 while it is taken. */
export function slugFor(tag: string, unionId: number, taken: ReadonlySet<string>): string {
  const plain = tag
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const base = WORKSPACE_SLUG.test(plain) ? plain : `a${unionId}`;
  const tries = [base, ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${base}-${n}`)];
  return tries.find((s) => !taken.has(s) && WORKSPACE_SLUG.test(s)) ?? `${base}-${unionId}`;
}

async function finish(
  db: Db,
  deps: StepDeps,
  row: InviteRow & { guildId: string },
  input: Extract<InviteInput, { action: "finish" }>,
): Promise<StepResult> {
  const taken = await takenWorkspaceKeys(db);
  // INVARIANT invite.new-only: an invite never edits a workspace, its alliance's or another's.
  if (taken.some((w) => w.unionId === row.unionId)) return no("has_desk");
  if (taken.some((w) => w.guild === row.guildId)) return no("taken");
  const listed = await guildRoles(deps.env, deps.fetch, row.guildId);
  if (!listed.ok) return listed;
  const ids = new Set(listed.roles.map((r) => r.id));
  const leaders = [...new Set(input.leader_role_ids)];
  const members = [...new Set(input.member_role_ids)];
  if (![...leaders, ...members].every((id) => ids.has(id))) return no("bad_role");
  const slug = slugFor(allianceOf(row.unionId).tag, row.unionId, new Set(taken.map((w) => w.slug)));
  const made = await createInvitedWorkspace(
    db,
    {
      inviteId: row.id,
      unionId: row.unionId,
      slug,
      guildId: row.guildId,
      leaderRoleIds: leaders,
      memberRoleIds: members,
      discordUserId: row.claimedBy ?? "",
      displayName: row.claimedName ?? "",
      claimHash: row.claimHash ?? "",
    },
    deps.now,
  );
  if (!made.ok) return no(made.code);
  await markBotSeen(db, made.workspaceId, deps.now);
  // The commands that are on (D126 defaults) in her server only; a refusal leaves Check in Alliance settings.
  await syncCommands(db, deps, { only: [made.workspaceId] }).catch(() => null);
  const session = await createSession(db, made.workspaceId, made.userId, deps.now, null, "officer");
  privateLog("w.invite.used", { invite: row.id, workspace: made.workspaceId });
  return { ok: true, slug, cookie: session.cookie };
}
