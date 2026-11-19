// A workspace's own data, downloaded or deleted (D125, issue 441), apart from lib/schema.ts for its size;
// drizzle.config.ts lists this file too. The deletion itself is three columns on `workspaces`.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
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

export const DATA_ACTIONS = ["download", "delete_asked", "delete_cancelled"] as const;
export type DataAction = (typeof DATA_ACTIONS)[number];

/**
 * "Download our data", "Delete this workspace" and "Cancel the deletion": who and when, one row per request
 * id (D100), for Home's line. `by` null: the site's owner, from /admin (no Home line). Deleted with the
 * workspace.
 */
export const workspaceDataEvents = pgTable(
  "workspace_data_events",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    action: text("action", { enum: DATA_ACTIONS }).notNull(),
    by: integer("by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    at: tstz("at").notNull(),
    requestId: text("request_id").notNull(),
  },
  (t) => [
    uniqueIndex("workspace_data_events_request_unique").on(t.workspaceId, t.requestId),
    index("workspace_data_events_workspace_at_idx").on(t.workspaceId, t.at),
    check(
      "workspace_data_events_action_check",
      sql`${t.action} in ('download', 'delete_asked', 'delete_cancelled')`,
    ),
  ],
);

/**
 * What is left of a deleted workspace, for /admin (D125): its address, its alliance, who asked and when, and
 * when the daily job deleted it. No member data and no link to any other row.
 */
export const workspaceTombstones = pgTable("workspace_tombstones", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  unionId: bigint("union_id", { mode: "number" }).notNull(),
  /** "TAG · Name" when the alliance is tracked, else null. */
  alliance: text("alliance"),
  /** Who asked: the site's owner on /admin (true) or an officer (false), never the officer's name. */
  byOwner: boolean("by_owner").notNull(),
  requestedAt: tstz("requested_at").notNull(),
  purgedAt: tstz("purged_at").notNull(),
});
