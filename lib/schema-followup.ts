// The Follow-up tab (issue 340, D104), split from lib/schema.ts for its size; lib/schema.ts re-exports it.
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";

/**
 * What an officer did about a member on the week's list, append-only: "Talked to them", On a break until
 * `until` (a server day), Needs help or "All fine", with a short note, who and when; Undo appends
 * "withdrawn", which cancels the member's newest record before it. The statuses also go
 * to member_facts (D80); this row is the history the member card shows. `request_id` is the sheet's
 * (D100): a retry stores nothing new. Read and written only by lib/repo and lib/private (D71).
 */
export const memberFollowUps = pgTable(
  "member_follow_ups",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    uid: bigint("uid", { mode: "number" }).notNull(),
    action: text("action", { enum: ["talked", "break", "help", "fine", "withdrawn"] }).notNull(),
    note: text("note"),
    until: text("until"),
    /** The member fact version a break or Needs help wrote, so Undo can put the one before back. */
    factVersion: integer("fact_version"),
    writtenBy: integer("written_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    writtenAt: timestamp("written_at", { withTimezone: true }).notNull(),
    requestId: uuid("request_id").notNull(),
    /**
     * Deleted from the member's history (D123 phase 2): who and when, under the question's request id
     * (D100). A deleted record leaves the history, Follow-up's lists and counts and Home; a fact it wrote
     * stays. Only a record still counting is deleted, never a "withdrawn". Undo clears `deleted_at`.
     */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: integer("deleted_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    deleteRequestId: text("delete_request_id"),
  },
  (t) => [
    index("member_follow_ups_workspace_uid_idx").on(t.workspaceId, t.uid, t.id),
    index("member_follow_ups_workspace_written_idx").on(t.workspaceId, t.writtenAt),
    unique("member_follow_ups_request_unique").on(t.workspaceId, t.requestId),
    check(
      "member_follow_ups_action_check",
      sql`${t.action} in ('talked', 'break', 'help', 'fine', 'withdrawn')`,
    ),
  ],
);
