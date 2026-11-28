// workspace_discord and workspace_webhooks (D129): the bot seen in a workspace's server, the commands
// registered there, and the two notice channels' sealed webhooks. Plain reads and writes; only
// lib/private/discord-webhooks.ts opens a sealed webhook, at call time.
import { and, eq, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces } from "../schema";
import { workspaceDiscord, workspaceWebhooks, type WebhookChannel } from "../schema-discord";

export type DiscordState = {
  botSeenAt: Date | null;
  commands: string[] | null;
  commandsAt: Date | null;
  /** Issue 868: the member role an approved join request gets; both null when none is chosen. */
  memberRoleId: string | null;
  memberRoleName: string | null;
};

const NONE: DiscordState = {
  botSeenAt: null,
  commands: null,
  commandsAt: null,
  memberRoleId: null,
  memberRoleName: null,
};

export async function discordState(db: Db, workspaceId: number): Promise<DiscordState> {
  const [row] = await db
    .select()
    .from(workspaceDiscord)
    .where(eq(workspaceDiscord.workspaceId, workspaceId));
  return row ?? NONE;
}

/** Every workspace's state, for /admin and the commands' sync. */
export async function allDiscordStates(db: Db): Promise<Map<number, DiscordState>> {
  const rows = await db.select().from(workspaceDiscord);
  return new Map(rows.map((r) => [r.workspaceId, r]));
}

/** Each workspace's Discord server id, by workspace id (one workspace per server, D126). */
export async function workspaceGuilds(db: Db): Promise<Map<number, string>> {
  const rows = await db
    .select({ id: workspaces.id, guildId: workspaces.discordGuildId })
    .from(workspaces);
  return new Map(rows.map((r) => [r.id, r.guildId]));
}

/** The bot seen in the server; true only the first time (the row had no `bot_seen_at`). */
export async function markBotSeen(db: Db, workspaceId: number, now: Date): Promise<boolean> {
  const before = await discordState(db, workspaceId);
  await db
    .insert(workspaceDiscord)
    .values({ workspaceId, botSeenAt: now })
    .onConflictDoUpdate({
      target: workspaceDiscord.workspaceId,
      set: { botSeenAt: sql`coalesce(${workspaceDiscord.botSeenAt}, excluded.bot_seen_at)` },
    });
  return before.botSeenAt === null;
}

/** The commands Discord took for the server, as now registered there. */
export async function recordCommands(db: Db, workspaceId: number, names: string[], now: Date) {
  await db
    .insert(workspaceDiscord)
    .values({ workspaceId, commands: names, commandsAt: now })
    .onConflictDoUpdate({
      target: workspaceDiscord.workspaceId,
      set: { commands: names, commandsAt: now },
    });
}

/** Issue 868: the member role officers chose (null: none), as Discord named it when it was saved. */
export async function saveMemberRole(
  db: Db,
  workspaceId: number,
  role: { id: string; name: string } | null,
) {
  const set = { memberRoleId: role?.id ?? null, memberRoleName: role?.name ?? null };
  await db
    .insert(workspaceDiscord)
    .values({ workspaceId, ...set })
    .onConflictDoUpdate({ target: workspaceDiscord.workspaceId, set });
}

/** A saved webhook's facts without its URL: for pages, /admin and the settings screen. */
export type WebhookFacts = {
  channel: WebhookChannel;
  name: string;
  forum: boolean;
  masterFp: string;
  savedAt: Date;
  requestId: string;
};

const FACTS = {
  channel: workspaceWebhooks.channel,
  name: workspaceWebhooks.name,
  forum: workspaceWebhooks.forum,
  masterFp: workspaceWebhooks.masterFp,
  savedAt: workspaceWebhooks.savedAt,
  requestId: workspaceWebhooks.requestId,
};

export function webhookFacts(db: Db, workspaceId: number): Promise<WebhookFacts[]> {
  return db
    .select(FACTS)
    .from(workspaceWebhooks)
    .where(eq(workspaceWebhooks.workspaceId, workspaceId));
}

/** Every workspace's saved channels (no URL), for /admin's "set / not set". */
export function allWebhookChannels(db: Db) {
  return db
    .select({ workspaceId: workspaceWebhooks.workspaceId, channel: workspaceWebhooks.channel })
    .from(workspaceWebhooks);
}

/** The sealed webhooks, for the modules that open them at call time (D129; D137's leaders' message). */
export function sealedWebhooks(db: Db, workspaceId: number) {
  return db
    .select({ ...FACTS, ciphertext: workspaceWebhooks.ciphertext, nonce: workspaceWebhooks.nonce })
    .from(workspaceWebhooks)
    .where(eq(workspaceWebhooks.workspaceId, workspaceId));
}

export type WebhookRow = typeof workspaceWebhooks.$inferInsert;

/** Save or replace one channel's webhook. */
export async function storeWebhook(db: Db, row: WebhookRow): Promise<void> {
  await db
    .insert(workspaceWebhooks)
    .values(row)
    .onConflictDoUpdate({
      target: [workspaceWebhooks.workspaceId, workspaceWebhooks.channel],
      set: {
        ciphertext: row.ciphertext,
        nonce: row.nonce,
        masterFp: row.masterFp,
        name: row.name,
        forum: row.forum,
        savedBy: row.savedBy,
        savedAt: row.savedAt,
        requestId: row.requestId,
      },
    });
}

export async function deleteWebhook(db: Db, workspaceId: number, channel: WebhookChannel) {
  await db
    .delete(workspaceWebhooks)
    .where(
      and(eq(workspaceWebhooks.workspaceId, workspaceId), eq(workspaceWebhooks.channel, channel)),
    );
}
