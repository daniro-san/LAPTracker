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
  smallint,
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

/** The catalog's optional posts (#713 part C, D159), in build order; lib/post-catalog.ts describes each. */
export const CATALOG_POSTS = ["week", "shield_up", "welcome"] as const;
export type CatalogPost = (typeof CATALOG_POSTS)[number];

/** The posts an alliance may put its own line on (#713, D156), the catalog's posts included (D159). */
export const POST_KEYS = ["shield", "thanks", "garrison", ...CATALOG_POSTS] as const;
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
      sql`${t.postKey} in ('shield', 'thanks', 'garrison', 'week', 'shield_up', 'welcome')`,
    ),
  ],
);

/** The channels a catalog post may go to: the workspace's two notice channels (D129). */
export const POST_CHANNELS = ["members", "leaders"] as const;
export type PostChannel = (typeof POST_CHANNELS)[number];

/**
 * The alliance's own settings of one catalog post (#713 part C, D159): its switch (the alliance's layer of
 * D134; the owner's is the post's feature), the channel, the weekday where the catalog lets it change (null:
 * the catalog's day), the officers' title (empty: ours, in the post's language), the picture where the post
 * has one, and the language it is written in. No row: off. Deleted with the workspace and downloaded (D125).
 */
export const workspacePosts = pgTable(
  "workspace_posts",
  {
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postKey: text("post_key", { enum: CATALOG_POSTS }).notNull(),
    on: boolean("on").notNull().default(false),
    channel: text("channel", { enum: POST_CHANNELS }).notNull(),
    /** 0 = Monday … 6 = Sunday, server time; null: the catalog's day. */
    weekday: smallint("weekday"),
    title: text("title").notNull().default(""),
    picture: boolean("picture").notNull().default(false),
    language: text("language").notNull().default("en"),
    updatedBy: integer("updated_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    updatedAt: tstz("updated_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.postKey] }),
    check("workspace_posts_post_key_check", sql`${t.postKey} in ('week', 'shield_up', 'welcome')`),
    check("workspace_posts_channel_check", sql`${t.channel} in ('members', 'leaders')`),
    check("workspace_posts_weekday_check", sql`${t.weekday} between 0 and 6`),
    check("workspace_posts_language_check", sql`${t.language} in ('en', 'pt-BR', 'fr')`),
  ],
);

/**
 * One catalog post's send for one period (D159): the claim that makes it go out at most once per workspace,
 * post and period (a server day, "2026-11-23"), however many ticks overlap. `sent`: the messages Discord
 * took. A send Discord refused (`failed`) before any message went through is claimed again by a later tick of
 * the same period, up to 3 attempts; one Discord never answered (`unanswered`: a timeout, so it may have
 * posted) never is. A week with no entry for members is `skipped`, so later ticks read nothing more for
 * it. Counts and codes only; deleted with the workspace,
 * never downloaded (D125).
 */
export const postRuns = pgTable(
  "post_runs",
  {
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    postKey: text("post_key", { enum: CATALOG_POSTS }).notNull(),
    period: text("period").notNull(),
    status: text("status", {
      enum: ["posting", "posted", "failed", "unanswered", "skipped"],
    }).notNull(),
    sent: integer("sent").notNull().default(0),
    attempts: smallint("attempts").notNull().default(1),
    at: tstz("at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.postKey, t.period] }),
    check(
      "post_runs_status_check",
      sql`${t.status} in ('posting', 'posted', 'failed', 'unanswered', 'skipped')`,
    ),
  ],
);
