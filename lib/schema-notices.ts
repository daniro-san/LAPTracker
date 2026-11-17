// The notices library's tables (issue 304, D81), apart from lib/schema.ts for its size. drizzle.config.ts lists
// both files; migration 0021 creates these two tables.
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
    check(
      "notice_edits_field_check",
      sql`${t.field} in ('title', 'en', 'pt-BR', 'fr', 'for_members', 'ends_on')`,
    ),
  ],
);
