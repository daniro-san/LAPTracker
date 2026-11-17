// The workspace's member facts and remembered sheet names (issue #297, D80), split from lib/schema.ts for
// its size; lib/schema.ts re-exports them, so drizzle-kit and the Db type see one schema.
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
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
    source: text("source", { enum: ["message", "officer", "sheet"] }).notNull(),
    writtenBy: integer("written_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    writtenAt: tstz("written_at").notNull(),
  },
  (t) => [
    unique("member_facts_version_unique").on(t.workspaceId, t.uid, t.field, t.version),
    check("member_facts_source_check", sql`${t.source} in ('message', 'officer', 'sheet')`),
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
