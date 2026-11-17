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
 * `until` (a server day), Needs help or "All fine", with a short note, who and when. The statuses also go
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
    action: text("action", { enum: ["talked", "break", "help", "fine"] }).notNull(),
    note: text("note"),
    until: text("until"),
    writtenBy: integer("written_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    writtenAt: timestamp("written_at", { withTimezone: true }).notNull(),
    requestId: uuid("request_id").notNull(),
  },
  (t) => [
    index("member_follow_ups_workspace_uid_idx").on(t.workspaceId, t.uid, t.id),
    unique("member_follow_ups_request_unique").on(t.workspaceId, t.requestId),
    check(
      "member_follow_ups_action_check",
      sql`${t.action} in ('talked', 'break', 'help', 'fine')`,
    ),
  ],
);
