// /admin's Workspaces card (D71, D73): each workspace's settings, its allowlist and how many sessions are
// open, and who holds them (for "Sign out users", D105), and whether its own tracker key is set and its
// status (D124: never the key, its last 4 characters or its quota). Owner only (PIN); no roster data.
import { and, asc, count, desc, eq, getTableColumns, gt, max, sql } from "drizzle-orm";

import type { Db } from "../db";
import { allDiscordStates, allWebhookChannels } from "../repo/workspace-discord";
import { allKeyFacts } from "../repo/workspace-keys";
import { workspaces, workspaceSessions, workspaceUsers } from "../schema";
import type { KeyStatus } from "../schema-keys";
import { workspaceTombstones } from "../schema-retention";

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
  /**
   * The workspace's own tracker key (D124): set or not, its last status and when, and which master key
   * sealed it (a fingerprint, not a secret), so the page can show `reenter` without a write.
   */
  trackerKey: { set: boolean; status: KeyStatus; statusAt: Date | null; masterFp: string | null };
  /**
   * "Delete this workspace" (D125): null when not asked; else when, by whom (the officer's name, null for
   * the site's owner) and the instant after which the daily job deletes it.
   */
  deletion: { askedAt: Date; byOwner: boolean; by: string | null; purgeAfter: Date } | null;
  /**
   * D129: whether the bot was seen in the server, the commands registered there (null: never) and which
   * notice channels have a webhook saved by the workspace. Never a webhook.
   */
  discord: { botSeen: boolean; commands: string[] | null; webhooks: string[] };
}

export interface SignedInPerson {
  userId: number;
  /** The name they chose, else Discord's display name; null when neither is known. */
  name: string | null;
  tier: "officer" | "member";
  /** The latest sign-in or Discord renewal of their open sessions (`checked_at`). */
  lastSeen: Date;
}

/** D125: the name of the officer who asked to delete the workspace (null: the owner, or none asked). */
const asker = sql<
  string | null
>`(select coalesce(u.chosen_name, u.display_name) from workspace_users u where u.id = ${workspaces.deletionRequestedBy})`;

/** D125: the deletion asked, or null. */
function deletionOf(
  w: typeof workspaces.$inferSelect & { asker: string | null },
): AdminWorkspace["deletion"] {
  if (!w.purgeAfter || !w.deletionRequestedAt) return null;
  const byOwner = w.deletionRequestedBy === null;
  return { askedAt: w.deletionRequestedAt, byOwner, by: w.asker, purgeAfter: w.purgeAfter };
}

/** D129: one workspace's bot, commands and saved webhook channels. */
function discordOf(
  id: number,
  states: Awaited<ReturnType<typeof allDiscordStates>>,
  hooks: Awaited<ReturnType<typeof allWebhookChannels>>,
): AdminWorkspace["discord"] {
  const state = states.get(id);
  return {
    botSeen: Boolean(state?.botSeenAt),
    commands: state?.commands ?? null,
    webhooks: hooks.filter((h) => h.workspaceId === id).map((h) => h.channel),
  };
}

export async function listWorkspaces(db: Db, now: Date): Promise<AdminWorkspace[]> {
  const [rows, sessions, allowed, people, keys, discord, hooks] = await Promise.all([
    db
      .select({ ...getTableColumns(workspaces), asker })
      .from(workspaces)
      .orderBy(asc(workspaces.slug)),
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
    allKeyFacts(db),
    allDiscordStates(db),
    allWebhookChannels(db),
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
    trackerKey: {
      set: keys.get(w.id)?.set ?? false,
      status: keys.get(w.id)?.status ?? "unset",
      statusAt: keys.get(w.id)?.statusAt ?? null,
      masterFp: keys.get(w.id)?.masterFp ?? null,
    },
    deletion: deletionOf(w),
    discord: discordOf(w.id, discord, hooks),
  }));
}

/** The workspaces the daily job deleted (D125), newest first: address, alliance, who asked, when. */
export function listTombstones(db: Db) {
  return db.select().from(workspaceTombstones).orderBy(desc(workspaceTombstones.purgedAt));
}
