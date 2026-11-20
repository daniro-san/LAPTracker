// workspaces, workspace_users and workspace_sessions (D71): what /admin writes, and the plain reads and
// writes lib/private builds on. Who gets in, and the WorkspaceAccess brand, stay in lib/private.
import { and, eq, gt, isNull, lt, lte, ne, or, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces, workspaceSessions, workspaceUsers } from "../schema";

export type WorkspaceRow = typeof workspaces.$inferSelect;
/** "officer": the desk (D71). "member": the members' board only (D105). */
export type SessionTier = "officer" | "member";

/** A workspace's address, /w/<slug>: lowercase letters, digits and dashes; "auth" is the callback's. */
export const WORKSPACE_SLUG = /^(?!auth$)[a-z0-9][a-z0-9-]{1,31}$/;

export async function findWorkspaceBySlug(db: Db, slug: string): Promise<WorkspaceRow | null> {
  const [row] = await db.select().from(workspaces).where(eq(workspaces.slug, slug));
  return row ?? null;
}

/**
 * The workspace whose Discord server this is: the Discord command's way in; null when none. A server has at
 * most one workspace (unique `discord_guild_id`, D126).
 */
export async function findWorkspaceByGuild(db: Db, guildId: string) {
  const [row] = await db.select().from(workspaces).where(eq(workspaces.discordGuildId, guildId));
  return row ?? null;
}

export interface WorkspaceInput {
  unionId: number;
  slug: string;
  discordGuildId: string;
  leaderRoleIds: string[];
  /** The members' board roles (D105, amended 2026-11-17); left out or empty: the board is closed. */
  memberRoleIds?: string[];
}

/** One workspace per alliance: a second save for the same union id edits it. */
export async function saveWorkspace(
  db: Db,
  input: WorkspaceInput,
): Promise<"ok" | "slug_taken" | "guild_taken"> {
  const others = await db
    .select({ slug: workspaces.slug, guild: workspaces.discordGuildId })
    .from(workspaces)
    .where(
      and(
        ne(workspaces.unionId, input.unionId),
        or(eq(workspaces.slug, input.slug), eq(workspaces.discordGuildId, input.discordGuildId)),
      ),
    );
  if (others.some((w) => w.slug === input.slug)) return "slug_taken";
  // D126: one workspace per Discord server (also a unique index), so a command finds one workspace.
  if (others.length > 0) return "guild_taken";
  const { slug, discordGuildId, leaderRoleIds } = input;
  const memberRoleIds = input.memberRoleIds ?? [];
  await db
    .insert(workspaces)
    .values({ ...input, memberRoleIds })
    .onConflictDoUpdate({
      target: workspaces.unionId,
      set: { slug, discordGuildId, leaderRoleIds, memberRoleIds },
    });
  return "ok";
}

/**
 * /admin's allowlist entry: the account is let in until the end of `expiresOn` (a YYYY-MM-DD day, UTC).
 * A day already over is refused.
 */
export async function allowUserUntil(
  db: Db,
  workspaceId: number,
  discordUserId: string,
  expiresOn: string,
  now: Date,
): Promise<"ok" | "not_found" | "expiry_past"> {
  const expiresAt = new Date(`${expiresOn}T23:59:59.999Z`);
  if (expiresAt.getTime() <= now.getTime()) return "expiry_past";
  return allowUser(db, workspaceId, discordUserId, expiresAt, "admin");
}

/** Puts a Discord account on the allowlist until `expiresAt`, or moves its expiry. */
export async function allowUser(
  db: Db,
  workspaceId: number,
  discordUserId: string,
  expiresAt: Date,
  addedBy: string,
): Promise<"ok" | "not_found"> {
  const [ws] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  if (!ws) return "not_found";
  const entry = { allowlisted: true, allowlistAddedBy: addedBy, allowlistExpiresAt: expiresAt };
  await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId, ...entry })
    .onConflictDoUpdate({
      target: [workspaceUsers.workspaceId, workspaceUsers.discordUserId],
      set: entry,
    });
  return "ok";
}

export type WorkspaceUserRow = typeof workspaceUsers.$inferSelect;

export async function findWorkspaceUser(
  db: Db,
  workspaceId: number,
  discordUserId: string,
): Promise<WorkspaceUserRow | null> {
  const [row] = await db
    .select()
    .from(workspaceUsers)
    .where(
      and(
        eq(workspaceUsers.workspaceId, workspaceId),
        eq(workspaceUsers.discordUserId, discordUserId),
      ),
    );
  return row ?? null;
}

/** A successful sign-in: the person's row with their current name; returns its id. */
export async function recordSignIn(
  db: Db,
  workspaceId: number,
  discordUserId: string,
  displayName: string,
  now: Date,
): Promise<number> {
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId, displayName, lastLoginAt: now })
    .onConflictDoUpdate({
      target: [workspaceUsers.workspaceId, workspaceUsers.discordUserId],
      set: { displayName, lastLoginAt: now },
    })
    .returning({ id: workspaceUsers.id });
  if (!user) throw new Error("workspace user upsert returned no row");
  return user.id;
}

/** Stores a session; sessions already past their end, of any workspace, are deleted first. */
export async function insertSession(
  db: Db,
  row: typeof workspaceSessions.$inferInsert,
  now: Date,
): Promise<void> {
  await db.delete(workspaceSessions).where(lte(workspaceSessions.expiresAt, now));
  await db.insert(workspaceSessions).values(row);
}

/**
 * A renewal after Discord confirmed the role again (D99): the session of this token, workspace, person and
 * tier (D105) that has not ended gets `checkedAt`, and its end moves no later than `endsBy`. False when
 * there is none.
 */
export async function renewSession(
  db: Db,
  key: { tokenHash: string; workspaceId: number; workspaceUserId: number; tier: SessionTier },
  checkedAt: Date,
  endsBy: Date | null,
): Promise<boolean> {
  const rows = await db
    .update(workspaceSessions)
    .set({
      checkedAt,
      ...(endsBy && { expiresAt: sql`least(${workspaceSessions.expiresAt}, ${endsBy})` }),
    })
    .where(
      and(
        eq(workspaceSessions.tokenHash, key.tokenHash),
        eq(workspaceSessions.workspaceId, key.workspaceId),
        eq(workspaceSessions.workspaceUserId, key.workspaceUserId),
        eq(workspaceSessions.tier, key.tier),
        gt(workspaceSessions.expiresAt, checkedAt),
      ),
    )
    .returning({ hash: workspaceSessions.tokenHash });
  return rows.length > 0;
}

/** The session with this token hash and its person, whatever its workspace. */
export async function findSession(db: Db, tokenHash: string) {
  const [row] = await db
    .select({
      tokenHash: workspaceSessions.tokenHash,
      workspaceId: workspaceSessions.workspaceId,
      expiresAt: workspaceSessions.expiresAt,
      checkedAt: workspaceSessions.checkedAt,
      tier: workspaceSessions.tier,
      seenAt: workspaceSessions.seenAt,
      userId: workspaceUsers.id,
      displayName: workspaceUsers.displayName,
      chosenName: workspaceUsers.chosenName,
      playerUid: workspaceUsers.playerUid,
      blocked: workspaceUsers.blocked,
    })
    .from(workspaceSessions)
    .innerJoin(workspaceUsers, eq(workspaceUsers.id, workspaceSessions.workspaceUserId))
    .where(eq(workspaceSessions.tokenHash, tokenHash));
  return row ?? null;
}

/**
 * "Last seen" on the desk (D108): written only when the stored time is older than `since`, so a session
 * writes at most once a minute however many requests it makes.
 */
export async function touchSession(db: Db, tokenHash: string, now: Date, since: Date) {
  await db
    .update(workspaceSessions)
    .set({ seenAt: now })
    .where(
      and(
        eq(workspaceSessions.tokenHash, tokenHash),
        or(isNull(workspaceSessions.seenAt), lt(workspaceSessions.seenAt, since)),
      ),
    );
}

/** The officer's own profile (issue 334): the name they chose, and "This is me" (null unlinks). */
export async function updateWorkspaceUser(
  db: Db,
  workspaceId: number,
  userId: number,
  set: { chosenName: string } | { playerUid: number | null },
): Promise<void> {
  await db
    .update(workspaceUsers)
    .set(set)
    .where(and(eq(workspaceUsers.id, userId), eq(workspaceUsers.workspaceId, workspaceId)));
}

/** Ends one session, only inside its own workspace. */
export async function deleteSession(db: Db, workspaceId: number, tokenHash: string): Promise<void> {
  await db
    .delete(workspaceSessions)
    .where(
      and(
        eq(workspaceSessions.tokenHash, tokenHash),
        eq(workspaceSessions.workspaceId, workspaceId),
      ),
    );
}

/** Whose sessions /admin's "Sign out users" ends (D105, amended 2026-11-17). */
export type SignOutWho =
  | { scope: "all" }
  | { scope: "officers" }
  | { scope: "members" }
  | { scope: "user"; userId: number };

/**
 * /admin's "Sign out users": ends the workspace's sessions now, all of them, one tier's, or every session
 * of one workspace_users row, only inside this workspace. Nobody is blocked. Returns how many ended.
 */
export async function signOutWorkspace(
  db: Db,
  workspaceId: number,
  who: SignOutWho = { scope: "all" },
): Promise<number> {
  const only =
    who.scope === "officers"
      ? eq(workspaceSessions.tier, "officer")
      : who.scope === "members"
        ? eq(workspaceSessions.tier, "member")
        : who.scope === "user"
          ? eq(workspaceSessions.workspaceUserId, who.userId)
          : undefined;
  const gone = await db
    .delete(workspaceSessions)
    .where(and(eq(workspaceSessions.workspaceId, workspaceId), only))
    .returning({ hash: workspaceSessions.tokenHash });
  return gone.length;
}
