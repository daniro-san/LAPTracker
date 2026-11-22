// Each workspace's own Discord set-up (D129, issue 451), apart from lib/schema.ts for its size; drizzle.config.ts
// lists this file too. `workspace_discord`: whether the bot was seen in the workspace's server and which message
// commands are registered there. `workspace_webhooks`: the leaders' and members' channels for "Publish to
// Discord" and the Raid Shield summary's own channel (D147), each webhook URL stored only encrypted
// (AES-256-GCM under WORKSPACE_KEYS_SECRET, as D124's key), with the channel name officers gave. No read
// model, route, page or log selects `ciphertext` or `nonce`.
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";

const tstz = (name: string) => timestamp(name, { withTimezone: true });

export const WEBHOOK_CHANNELS = ["leaders", "members", "shield"] as const;
export type WebhookChannel = (typeof WEBHOOK_CHANNELS)[number];

/** One row per workspace once its officers checked the bot, or the owner registered its commands. */
export const workspaceDiscord = pgTable("workspace_discord", {
  workspaceId: integer("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  /** The first time the bot token saw the bot in the workspace's server; null: never seen. */
  botSeenAt: tstz("bot_seen_at"),
  /** The command names last registered in the server (Discord took them); null: never registered. */
  commands: jsonb("commands").$type<string[]>(),
  commandsAt: tstz("commands_at"),
});

/** One row per workspace and channel once a webhook was saved; Remove deletes the row. */
export const workspaceWebhooks = pgTable(
  "workspace_webhooks",
  {
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    channel: text("channel", { enum: WEBHOOK_CHANNELS }).notNull(),
    /** base64 of the AES-256-GCM ciphertext of the webhook URL followed by its 16-byte tag. */
    ciphertext: text("ciphertext").notNull(),
    /** base64 of the 12-byte nonce, new on every write. */
    nonce: text("nonce").notNull(),
    /** Which master key sealed it (D124's fingerprint, not a secret). */
    masterFp: text("master_fp").notNull(),
    /** The channel's name as officers typed it, shown before posting ("notices"). */
    name: text("name").notNull(),
    /** A forum channel: Discord needs a post title (`thread_name`) there and refuses it elsewhere. */
    forum: boolean("forum").notNull(),
    savedBy: integer("saved_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    savedAt: tstz("saved_at").notNull(),
    /** The save's request id (D100): a repeat makes no second check with Discord. */
    requestId: text("request_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.channel] }),
    check(
      "workspace_webhooks_channel_check",
      sql`${t.channel} in ('leaders', 'members', 'shield')`,
    ),
  ],
);

/** The posts an alliance may put its own line on (#713, D156). */
export const POST_KEYS = ["shield", "thanks", "garrison"] as const;
export type PostKey = (typeof POST_KEYS)[number];

/**
 * An alliance's own touches on the posts LAPTracker makes for it (#713, D156): one row per workspace and
 * post, holding the officers' one line (the callout, at most 120 graphemes, never translated; empty: no
 * line) and who changed it last. Deleted with the workspace and downloaded (D125).
 */
export const workspacePostTouches = pgTable(
  "workspace_post_touches",
  {
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postKey: text("post_key", { enum: POST_KEYS }).notNull(),
    callout: text("callout").notNull(),
    updatedBy: integer("updated_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    updatedAt: tstz("updated_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.postKey] }),
    check(
      "workspace_post_touches_post_key_check",
      sql`${t.postKey} in ('shield', 'thanks', 'garrison')`,
    ),
  ],
);
