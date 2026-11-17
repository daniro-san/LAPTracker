// /admin's Workspaces card (D71, D73): each workspace's settings, its allowlist and how many sessions are
// open. Owner only (PIN); no roster data.
import { asc, count, eq, gt, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces, workspaceSessions, workspaceUsers } from "../schema";

export interface AdminWorkspace {
  id: number;
  slug: string;
  unionId: number;
  discordGuildId: string;
  leaderRoleIds: string[];
  openSessions: number;
  /** Of them, members' sessions (D105). */
  memberSessions: number;
  allowlist: { discordUserId: string; expiresAt: Date | null }[];
}

export async function listWorkspaces(db: Db, now: Date): Promise<AdminWorkspace[]> {
  const [rows, sessions, allowed] = await Promise.all([
    db.select().from(workspaces).orderBy(asc(workspaces.slug)),
    db
      .select({
        workspaceId: workspaceSessions.workspaceId,
        n: count(),
        members: sql<number>`count(*) filter (where ${workspaceSessions.tier} = 'member')`.mapWith(
          Number,
        ),
      })
      .from(workspaceSessions)
      .where(gt(workspaceSessions.expiresAt, now))
      .groupBy(workspaceSessions.workspaceId),
    db
      .select({
        workspaceId: workspaceUsers.workspaceId,
        discordUserId: workspaceUsers.discordUserId,
        expiresAt: workspaceUsers.allowlistExpiresAt,
      })
      .from(workspaceUsers)
      .where(eq(workspaceUsers.allowlisted, true))
      .orderBy(asc(workspaceUsers.id)),
  ]);
  return rows.map((w) => ({
    id: w.id,
    slug: w.slug,
    unionId: w.unionId,
    discordGuildId: w.discordGuildId,
    leaderRoleIds: w.leaderRoleIds,
    openSessions: sessions.find((s) => s.workspaceId === w.id)?.n ?? 0,
    memberSessions: sessions.find((s) => s.workspaceId === w.id)?.members ?? 0,
    allowlist: allowed
      .filter((a) => a.workspaceId === w.id)
      .map(({ discordUserId, expiresAt }) => ({ discordUserId, expiresAt })),
  }));
}
