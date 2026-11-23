// What officers and members send the site's owner from the desk and the board (D157, issue 713): an idea, a
// problem or something good, without the sender. drizzle.config.ts lists this file too.
import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

import {
  FEEDBACK_AREAS,
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
  FEEDBACK_TIERS,
} from "./feedback-words";
import { workspaces } from "./schema";
import { bytea } from "./schema-notices";

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

/**
 * A send's one picture (D157 amended 2026-11-22), checked as a notice's is (D119): WebP, JPEG or PNG, at most
 * 400 KB and 1600 px a side, re-encoded in the browser, so EXIF is gone. Deleted with its row (the 180-day
 * purge) and with its workspace (D125); never downloaded, and served only on /admin/feedback (PIN).
 * `hash` is the bytes' SHA-256 (hex, first 16), the picture's ETag and the version in its URL.
 */
export const feedbackPictures = pgTable(
  "feedback_pictures",
  {
    feedbackId: integer("feedback_id")
      .primaryKey()
      .references(() => feedback.id, { onDelete: "cascade" }),
    workspaceId: integer("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    data: bytea("data").notNull(),
    type: text("type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    hash: text("hash").notNull(),
  },
  (t) => [
    // D125's purge and count find a workspace's pictures by it.
    index("feedback_pictures_workspace_idx").on(t.workspaceId),
    check(
      "feedback_pictures_type_check",
      sql`${t.type} in ('image/webp', 'image/jpeg', 'image/png')`,
    ),
    check("feedback_pictures_bytes_check", sql`${t.bytes} between 1 and 409600`),
    check(
      "feedback_pictures_side_check",
      sql`${t.width} between 1 and 1600 and ${t.height} between 1 and 1600`,
    ),
    check("feedback_pictures_data_check", sql`octet_length(${t.data}) between 1 and 409600`),
  ],
);
