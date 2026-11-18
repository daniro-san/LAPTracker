// The notices library's tables (issue 304, D81), apart from lib/schema.ts for its size. drizzle.config.ts lists
// this file; migration 0021 creates the first two tables, 0028 the publishes (D102); deleted_* columns, D118.
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";

const tstz = (name: string) => timestamp(name, { withTimezone: true });

/**
 * The notices library (issue 304): one row per notice, with who wrote it and who changed it last. The text
 * lives in notice_edits, one row per saved field (issue 293's rule: field-level, append-only).
 */
export const notices = pgTable(
  "notices",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdBy: integer("created_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    createdAt: tstz("created_at").notNull(),
    updatedBy: integer("updated_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    updatedAt: tstz("updated_at").notNull(),
    /** The new-notice editor's request id (D100): a retry of the same first Save finds this notice. */
    requestId: text("request_id"),
    /**
     * Deleted (D118): who and when, under the delete sheet's request id (D100). A deleted notice leaves every
     * list and read; its row and edits stay, so its title at the time is kept. Undo clears `deleted_at`.
     */
    deletedAt: tstz("deleted_at"),
    deletedBy: integer("deleted_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    deleteRequestId: text("delete_request_id"),
    /** The last restore from the trash (D118): any officer, after the Undo window, under its request id. */
    restoredAt: tstz("restored_at"),
    restoredBy: integer("restored_by").references(() => workspaceUsers.id, {
      onDelete: "set null",
    }),
    restoreRequestId: text("restore_request_id"),
  },
  (t) => [
    index("notices_workspace_idx").on(t.workspaceId),
    uniqueIndex("notices_request_unique").on(t.workspaceId, t.requestId),
  ],
);

/**
 * Every saved value of a notice's fields: the title, the three languages, for_members ("true"/"false")
 * and ends_on (YYYY-MM-DD, "" when cleared). The newest row per field is the current value, and its id
 * is the version an edit must name (409 otherwise). `basis` (languages only) is the revision of the text
 * that language reflects; a translation takes its source's, so an older basis means "may be out of date".
 */
export const noticeEdits = pgTable(
  "notice_edits",
  {
    id: serial("id").primaryKey(),
    noticeId: integer("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    value: text("value").notNull(),
    basis: integer("basis"),
    editedBy: integer("edited_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    editedAt: tstz("edited_at").notNull(),
  },
  (t) => [
    index("notice_edits_notice_field_idx").on(t.noticeId, t.field, t.id),
    index("notice_edits_workspace_edited_idx").on(t.workspaceId, t.editedAt),
    check(
      "notice_edits_field_check",
      sql`${t.field} in ('title', 'en', 'pt-BR', 'fr', 'for_members', 'ends_on')`,
    ),
  ],
);

/**
 * Each "Publish to Discord" of a notice (D102): who, when, to which audience's channel and in which
 * languages, and how it ended. The row is claimed before anything is posted, under the publish sheet's
 * request id (D100), so a double tap or a retry posts once. No webhook URL, channel name or text is kept.
 */
export const noticePublishes = pgTable(
  "notice_publishes",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    noticeId: integer("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    requestId: text("request_id").notNull(),
    /** "members" or "leaders": the notice's audience when it was posted, which chose the channel. */
    audience: text("audience").notNull(),
    /** The languages posted, comma-separated, in the order posted. */
    languages: text("languages").notNull(),
    /** "posting" while it runs, then "posted" or "failed". */
    status: text("status").notNull(),
    /** How many messages Discord accepted. */
    messages: integer("messages").notNull().default(0),
    publishedBy: integer("published_by").references(() => workspaceUsers.id, {
      onDelete: "set null",
    }),
    publishedAt: tstz("published_at").notNull(),
  },
  (t) => [
    uniqueIndex("notice_publishes_request_unique").on(t.workspaceId, t.requestId),
    index("notice_publishes_notice_idx").on(t.noticeId, t.id),
    check("notice_publishes_audience_check", sql`${t.audience} in ('members', 'leaders')`),
    check("notice_publishes_status_check", sql`${t.status} in ('posting', 'posted', 'failed')`),
  ],
);

/**
 * Review requests on a notice (D113): an officer asks the whole team (`reviewer_id` null) or one officer to
 * look at the whole notice (`language` null) or one language. Append-only, made under the ask sheet's
 * request id (D100). A request is open until it has a row in notice_review_outcomes.
 */
export const noticeReviews = pgTable(
  "notice_reviews",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    noticeId: integer("notice_id")
      .notNull()
      .references(() => notices.id, { onDelete: "cascade" }),
    requestId: text("request_id").notNull(),
    language: text("language"),
    reviewerId: integer("reviewer_id").references(() => workspaceUsers.id, {
      onDelete: "set null",
    }),
    askedBy: integer("asked_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    askedAt: tstz("asked_at").notNull(),
  },
  (t) => [
    uniqueIndex("notice_reviews_request_unique").on(t.workspaceId, t.requestId),
    index("notice_reviews_notice_idx").on(t.noticeId, t.id),
    check("notice_reviews_language_check", sql`${t.language} in ('en', 'pt-BR', 'fr')`),
  ],
);

/**
 * How a review request ended (D113): "approved", or "edited" when the reviewer saved an edit from it. One
 * per request (the first wins), append-only, with who and when, under its own request id (D100).
 */
export const noticeReviewOutcomes = pgTable(
  "notice_review_outcomes",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    reviewId: integer("review_id")
      .notNull()
      .references(() => noticeReviews.id, { onDelete: "cascade" }),
    requestId: text("request_id").notNull(),
    outcome: text("outcome").$type<"approved" | "edited">().notNull(),
    by: integer("by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    at: tstz("at").notNull(),
  },
  (t) => [
    uniqueIndex("notice_review_outcomes_review_unique").on(t.reviewId),
    uniqueIndex("notice_review_outcomes_request_unique").on(t.workspaceId, t.requestId),
    check("notice_review_outcomes_outcome_check", sql`${t.outcome} in ('approved', 'edited')`),
  ],
);
