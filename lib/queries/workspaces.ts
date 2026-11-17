// /admin's Workspaces card (D71, D73): each workspace's settings, its allowlist and how many sessions are
// open, and who holds them (for "Sign out users", D105). Owner only (PIN); no roster data.
import { and, asc, count, eq, gt, max, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces, workspaceSessions, workspaceUsers } from "../schema";

export interface AdminWorkspace {
  id: number;
  slug: string;
  unionId: number;
  discordGuildId: string;
  leaderRoleIds: string[];
  /** The members' board roles (D105, amended 2026-11-17); empty: the board is closed. */
  memberRoleIds: string[];
  openSessions: number;
  allowlist: { discordUserId: string; expiresAt: Date | null }[];
  /** Each person with an open session: officer if any of their open sessions is an officer's. */
  signedIn: SignedInPerson[];
}

export interface SignedInPerson {
  userId: number;
  /** The name they chose, else Discord's display name; null when neither is known. */
  name: string | null;
  tier: "officer" | "member";
  /** The latest sign-in or Discord renewal of their open sessions (`checked_at`). */
  lastSeen: Date;
}

export async function listWorkspaces(db: Db, now: Date): Promise<AdminWorkspace[]> {
  const [rows, sessions, allowed, people] = await Promise.all([
    db.select().from(workspaces).orderBy(asc(workspaces.slug)),
    db
      .select({
        workspaceId: workspaceSessions.workspaceId,
        n: count(),
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
    db
      .select({
        workspaceId: workspaceSessions.workspaceId,
        userId: workspaceUsers.id,
        name: sql<
          string | null
        >`coalesce(${workspaceUsers.chosenName}, ${workspaceUsers.displayName})`,
        officer: sql<boolean>`bool_or(${workspaceSessions.tier} = 'officer')`,
        lastSeen: max(workspaceSessions.checkedAt),
      })
      .from(workspaceSessions)
      .innerJoin(
        workspaceUsers,
        and(
          eq(workspaceUsers.id, workspaceSessions.workspaceUserId),
          eq(workspaceUsers.workspaceId, workspaceSessions.workspaceId),
        ),
      )
      .where(gt(workspaceSessions.expiresAt, now))
      .groupBy(workspaceSessions.workspaceId, workspaceUsers.id)
      .orderBy(sql`max(${workspaceSessions.checkedAt}) desc`, asc(workspaceUsers.id)),
  ]);
  return rows.map((w) => ({
    id: w.id,
    slug: w.slug,
    unionId: w.unionId,
    discordGuildId: w.discordGuildId,
    leaderRoleIds: w.leaderRoleIds,
    memberRoleIds: w.memberRoleIds,
    openSessions: sessions.find((s) => s.workspaceId === w.id)?.n ?? 0,
    allowlist: allowed
      .filter((a) => a.workspaceId === w.id)
      .map(({ discordUserId, expiresAt }) => ({ discordUserId, expiresAt })),
    signedIn: people
      .filter((p) => p.workspaceId === w.id)
      .map((p) => ({
        userId: p.userId,
        name: p.name,
        tier: p.officer ? ("officer" as const) : ("member" as const),
        lastSeen: new Date(p.lastSeen ?? 0),
      })),
  }));
}
