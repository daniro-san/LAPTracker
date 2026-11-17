// The members' board's one record (D105, issue 331), apart from lib/schema.ts for its size. drizzle.config.ts
// lists this file.
import { integer, jsonb, pgTable, timestamp } from "drizzle-orm/pg-core";

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
