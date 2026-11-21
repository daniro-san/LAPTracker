// workspace_sessions (D71, D99, D105), split from lib/schema.ts for its size and re-exported there.
import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";

const tstz = (name: string) => timestamp(name, { withTimezone: true });

/** Signed-in sessions (D71): only the token's sha256 is stored; each belongs to one workspace, 24 h. */
export const workspaceSessions = pgTable(
  "workspace_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    workspaceUserId: integer("workspace_user_id")
      .notNull()
      .references(() => workspaceUsers.id, { onDelete: "cascade" }),
    createdAt: tstz("created_at").notNull(),
    expiresAt: tstz("expires_at").notNull(),
    /** When Discord last confirmed the role (D99): at sign-in and at each renewal. */
    checkedAt: tstz("checked_at").notNull().defaultNow(),
    /** "officer": the desk (D71). "member": the members' board only (D105). */
    tier: text("tier").$type<"officer" | "member">().notNull().default("officer"),
    /** The last request this session made on the desk, kept to the minute (D108): "On the desk now". */
    seenAt: tstz("seen_at"),
  },
  (t) => [
    index("workspace_sessions_workspace_idx").on(t.workspaceId),
    check("workspace_sessions_tier_check", sql`${t.tier} in ('officer', 'member')`),
  ],
);
