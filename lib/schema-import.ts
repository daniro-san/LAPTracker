// The screenshot import's tables (issue 299, D96), apart from lib/schema.ts so the workspace's parallel
// sessions do not edit one file. A draft keeps the OCR text and the rows read from it, never the picture,
// and is deleted 7 days after it was made. Saved Alliance Duel points and check records stay.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";
import type { SecretOpsEntry } from "./screenshot/parse-secret-ops";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
const big = (name: string) => bigint(name, { mode: "number" });

/** A row of a draft as stored: what was read, and which member the name matcher found. */
export interface StoredRow {
  rank: number | null;
  /** The name as the OCR read it. */
  name: string;
  value: number | null;
  /** The parser's flags: order, rank, gap, points. */
  flags: string[];
  match:
    { status: "sure"; uid: number } | { status: "doubtful"; uids: number[] } | { status: "none" };
  /** Member update: which member fact `value` is (D80). */
  field?: "squadMight" | "adTech";
  /** Secret Ops report: the entry as read; `name` is its attacker. */
  entry?: SecretOpsEntry;
}

/**
 * One import waiting for review, shared by the workspace's officers (D71). `pages` holds each picture's
 * OCR text lines, so a change of type parses them again. `version` grows on every change: the first save
 * wins and a second one is refused. Nothing in it counts anywhere until it is saved (D75).
 */
export const screenshotDrafts = pgTable(
  "screenshot_drafts",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    scope: text("scope"),
    scopeSure: boolean("scope_sure").notNull(),
    /** The server day the picture belongs to: when it was posted on Discord, or uploaded. */
    pictureDay: date("picture_day", { mode: "string" }).notNull(),
    pages: jsonb("pages").$type<string[][]>().notNull(),
    rows: jsonb("rows").$type<StoredRow[]>().notNull(),
    /** Rows of other alliances left out (a ranking read without "My Alliance"). */
    leftOut: integer("left_out").notNull().default(0),
    /** desk and discord: pictures; pasted: lines typed or pasted into Members' "Paste updates" (D109). */
    source: text("source", { enum: ["desk", "discord", "pasted"] }).notNull(),
    sentBy: text("sent_by"),
    status: text("status", { enum: ["open", "saved", "discarded"] })
      .notNull()
      .default("open"),
    version: integer("version").notNull().default(1),
    doneBy: integer("done_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    doneAt: tstz("done_at"),
    createdAt: tstz("created_at").notNull(),
    expiresAt: tstz("expires_at").notNull(),
  },
  (t) => [
    index("screenshot_drafts_workspace_idx").on(t.workspaceId, t.status),
    check("screenshot_drafts_status_check", sql`${t.status} in ('open', 'saved', 'discarded')`),
    check("screenshot_drafts_source_check", sql`${t.source} in ('desk', 'discord', 'pasted')`),
  ],
);

/**
 * A Discord message's picture already sent through "Send to LAPTracker" (D100): a second run on the same
 * message and attachment makes no new draft and answers with the first one's link. `draft_id` is the draft
 * the picture went into; null when it made none, or while it is being read. Kept as long as a draft.
 */
export const discordPictures = pgTable(
  "discord_pictures",
  {
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    attachmentId: text("attachment_id").notNull(),
    draftId: integer("draft_id").references(() => screenshotDrafts.id, { onDelete: "cascade" }),
    createdAt: tstz("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.messageId, t.attachmentId] })],
);

/** Alliance Duel points from a saved picture: one member's points for one day (Mon-Sat) or the week. */
export const allianceDuelPoints = pgTable(
  "alliance_duel_points",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    uid: big("uid").notNull(),
    /** The Monday of the game week. */
    week: date("week", { mode: "string" }).notNull(),
    day: text("day", { enum: ["mon", "tue", "wed", "thu", "fri", "sat", "week"] }).notNull(),
    points: big("points").notNull(),
    savedBy: integer("saved_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    savedAt: tstz("saved_at").notNull(),
  },
  (t) => [
    unique("alliance_duel_points_unique").on(t.workspaceId, t.week, t.day, t.uid),
    check(
      "alliance_duel_points_day_check",
      sql`${t.day} in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'week')`,
    ),
  ],
);

/** A donation, might or kills ranking checked against our reads: only the counts are kept. */
export const screenshotChecks = pgTable("screenshot_checks", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  scope: text("scope"),
  pictureDay: date("picture_day", { mode: "string" }).notNull(),
  rows: integer("rows").notNull(),
  compared: integer("compared").notNull(),
  same: integer("same").notNull(),
  differ: integer("differ").notNull(),
  savedBy: integer("saved_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
  savedAt: tstz("saved_at").notNull(),
});
