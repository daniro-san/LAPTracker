// The workspace's member facts and remembered sheet names (issue #297, D80), split from lib/schema.ts for
// its size; lib/schema.ts re-exports them, so drizzle-kit and the Db type see one schema.
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
const big = (name: string) => bigint(name, { mode: "number" });

/**
 * Member facts: what officers record about one member of their own alliance, one field per row,
 * append-only. Each write of a field is the next `version` of that field (unique, so two officers saving
 * the same field at once cannot both win), with where the value came from. A null value clears the
 * field. Read and written only by lib/repo and lib/private (D71).
 */
export const memberFacts = pgTable(
  "member_facts",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    uid: big("uid").notNull(),
    field: text("field").notNull(),
    version: integer("version").notNull(),
    value: jsonb("value"),
    // "tracker": the strongest squad the tracker saw, written by the nightly squads read (D117).
    source: text("source", { enum: ["message", "officer", "sheet", "tracker"] }).notNull(),
    writtenBy: integer("written_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    writtenAt: tstz("written_at").notNull(),
  },
  (t) => [
    unique("member_facts_version_unique").on(t.workspaceId, t.uid, t.field, t.version),
    // Home's recent activity (D108) reads the newest saves.
    index("member_facts_workspace_written_idx").on(t.workspaceId, t.writtenAt),
    check(
      "member_facts_source_check",
      sql`${t.source} in ('message', 'officer', 'sheet', 'tracker')`,
    ),
  ],
);

/**
 * A sheet name a person matched to a member once, so the next sheet with that name asks nothing. Keyed by
 * the name's comparison form (nameKey); a null uid means "not a member" (dismissed).
 */
export const nameAliases = pgTable(
  "name_aliases",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    nameKey: text("name_key").notNull(),
    uid: big("uid"),
    confirmedBy: integer("confirmed_by").references(() => workspaceUsers.id, {
      onDelete: "set null",
    }),
    confirmedAt: tstz("confirmed_at").notNull(),
  },
  (t) => [unique("name_aliases_workspace_key_unique").on(t.workspaceId, t.nameKey)],
);

/**
 * A new member an officer added by hand before the roster lists them (D106). Their facts live in
 * member_facts under the uid `-id` (game uids are positive), so one facts pipeline serves both. A roster
 * read after `created_at` with exactly one member of the same name key and no facts moves those facts to
 * that member and sets `matched_uid`; an officer can also link them by hand. Delete sets `dismissed_at`
 * (with who and the request id, D123) and keeps the row with its facts and points (amendment 2026-11-17); adding the name again reopens it.
 */
export const pendingMembers = pgTable(
  "pending_members",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    /** The add sheet's request id (D100); null when made from the screenshot import. */
    requestId: text("request_id"),
    createdBy: integer("created_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    createdAt: tstz("created_at").notNull(),
    matchedUid: big("matched_uid"),
    matchedAt: tstz("matched_at"),
    /**
     * Deleted (D123; "dismissed" in D106's words, hence the column's name): who and when, under the delete
     * question's request id (D100). Undo clears it; adding the name again reopens the row.
     */
    deletedAt: tstz("dismissed_at"),
    deletedBy: integer("deleted_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    deleteRequestId: text("delete_request_id"),
  },
  (t) => [
    uniqueIndex("pending_members_request_unique").on(t.workspaceId, t.requestId),
    uniqueIndex("pending_members_open_key_unique")
      .on(t.workspaceId, t.nameKey)
      .where(sql`${t.matchedUid} is null and ${t.deletedAt} is null`),
  ],
);
