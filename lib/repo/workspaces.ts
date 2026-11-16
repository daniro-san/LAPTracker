// workspaces, workspace_users and workspace_sessions: what /admin writes (D71) and the slug lookup
// lib/private starts from. Everything a signed-in officer reads goes through lib/private.
import { and, eq, ne } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces, workspaceSessions, workspaceUsers } from "../schema";

export type WorkspaceRow = typeof workspaces.$inferSelect;

/** A workspace's address, /w/<slug>: lowercase letters, digits and dashes; "auth" is the callback's. */
export const WORKSPACE_SLUG = /^(?!auth$)[a-z0-9][a-z0-9-]{1,31}$/;

export async function findWorkspaceBySlug(db: Db, slug: string): Promise<WorkspaceRow | null> {
  const [row] = await db.select().from(workspaces).where(eq(workspaces.slug, slug));
  return row ?? null;
}

export interface WorkspaceInput {
  unionId: number;
  slug: string;
  discordGuildId: string;
  leaderRoleIds: string[];
}

/** One workspace per alliance: a second save for the same union id edits it. */
export async function saveWorkspace(db: Db, input: WorkspaceInput): Promise<"ok" | "slug_taken"> {
  const [taken] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.slug, input.slug), ne(workspaces.unionId, input.unionId)));
  if (taken) return "slug_taken";
  const { slug, discordGuildId, leaderRoleIds } = input;
  await db.insert(workspaces).values(input).onConflictDoUpdate({
    target: workspaces.unionId,
    set: { slug, discordGuildId, leaderRoleIds },
  });
  return "ok";
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

/** "Sign out everyone in this workspace": every session of the workspace ends now. */
export async function signOutWorkspace(db: Db, workspaceId: number): Promise<number> {
  const gone = await db
    .delete(workspaceSessions)
    .where(eq(workspaceSessions.workspaceId, workspaceId))
    .returning({ hash: workspaceSessions.tokenHash });
  return gone.length;
}
