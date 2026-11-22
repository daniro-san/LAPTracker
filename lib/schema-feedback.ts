// What officers and members send the site's owner from the desk and the board (D157, issue 713): an idea, a
// problem or something good, without the sender. drizzle.config.ts lists this file too.
import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import { workspaces } from "./schema";

export const FEEDBACK_AREAS = ["desk", "board"] as const;
export const FEEDBACK_KINDS = ["idea", "problem", "good"] as const;
export const FEEDBACK_STATUSES = ["new", "read", "issue", "dropped"] as const;
export const FEEDBACK_TIERS = ["officer", "member"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

/**
 * One send, kept 180 days (purged by the daily job) and deleted with its workspace (D125). Never who sent it:
 * no workspace user, uid, Discord id, name or IP. `text` was passed through redactPrivate before it was
 * stored. `workspace_id` is null only for a later public page's send.
 */
export const feedback = pgTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    area: text("area", { enum: FEEDBACK_AREAS }).notNull(),
    kind: text("kind", { enum: FEEDBACK_KINDS }).notNull(),
    text: text("text").notNull(),
    /** The page it was sent from, without its query. */
    path: text("path").notNull(),
    language: text("language").notNull(),
    workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    tier: text("tier", { enum: FEEDBACK_TIERS }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    status: text("status", { enum: FEEDBACK_STATUSES }).notNull().default("new"),
  },
  (t) => [
    // The owner's list (newest first) and the 180-day purge (D149).
    index("feedback_created_at_idx").on(t.createdAt),
    check("feedback_area_check", sql`${t.area} in ('desk', 'board')`),
    check("feedback_kind_check", sql`${t.kind} in ('idea', 'problem', 'good')`),
    check("feedback_status_check", sql`${t.status} in ('new', 'read', 'issue', 'dropped')`),
    check("feedback_tier_check", sql`${t.tier} in ('officer', 'member')`),
    check("feedback_language_check", sql`${t.language} in ('en', 'pt-BR', 'fr')`),
  ],
);
