// The members' board's records (D105, issue 331; the weekly thanks, D114), apart from lib/schema.ts for its
// size. drizzle.config.ts lists this file.
import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";
import type { FieldEdits } from "./schema-calendar";

/** One language of Start here: the glossary, the rules and who to ask, as officers wrote them. */
export interface StartHereText {
  glossary: string;
  rules: string;
  ask: string;
}

/**
 * "Start here" (D105): one record per workspace that officers edit and members read. `texts` holds each
 * language that was written (en, pt-BR, fr). Each language is one field of issue 293's rule: `edits` keeps
 * its version, who and when, and a save naming an older version is refused (409).
 */
export const startHere = pgTable("start_here", {
  workspaceId: integer("workspace_id")
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  texts: jsonb("texts").$type<Partial<Record<string, StartHereText>>>().notNull().default({}),
  rev: integer("rev").notNull().default(0),
  edits: jsonb("edits").$type<FieldEdits>().notNull().default({}),
  updatedBy: integer("updated_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

const tstz = (name: string) => timestamp(name, { withTimezone: true });

/**
 * "Share the thanks" (D114): one append-only row per share an officer made, to Discord's members channel
 * or to the members' board, claimed under its request id before anything is posted (D100). It keeps who,
 * when, the week it thanks (its Monday), the text per language as shared, and the names the officer
 * ticked. A Discord share is "posting" while it runs, then "posted" or "failed"; a board share is "posted"
 * at once. The board shows the newest posted board share that no officer took down.
 */
export const thanksShares = pgTable(
  "thanks_shares",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    requestId: text("request_id").notNull(),
    /** "discord" or "board". */
    target: text("target").notNull(),
    /** The Monday of the game week thanked (server day). */
    week: date("week", { mode: "string" }).notNull(),
    texts: jsonb("texts").$type<Partial<Record<string, string>>>().notNull(),
    names: jsonb("names").$type<string[]>().notNull(),
    status: text("status").notNull(),
    sharedBy: integer("shared_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    sharedAt: tstz("shared_at").notNull(),
  },
  (t) => [
    uniqueIndex("thanks_shares_request_unique").on(t.workspaceId, t.requestId),
    index("thanks_shares_workspace_idx").on(t.workspaceId, t.target, t.id),
    check("thanks_shares_target_check", sql`${t.target} in ('discord', 'board')`),
    check("thanks_shares_status_check", sql`${t.status} in ('posting', 'posted', 'failed')`),
  ],
);

/** "Take down" on the board's thanks card (D114): appended, never deleting the share it hides. */
export const thanksTakedowns = pgTable("thanks_takedowns", {
  id: serial("id").primaryKey(),
  shareId: integer("share_id")
    .notNull()
    .unique()
    .references(() => thanksShares.id, { onDelete: "cascade" }),
  takenBy: integer("taken_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
  takenAt: tstz("taken_at").notNull(),
});
