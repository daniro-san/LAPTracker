// The thefts log's tables (issue 321, D97), apart from lib/schema.ts for its size. drizzle.config.ts lists
// both files.
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
} from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
const big = (name: string) => bigint(name, { mode: "number" });

/**
 * One Secret Operations theft from a member of the workspace's alliance (issue 321): who took it (a player
 * of the same server), whose it was, when, and where the entry came from. `attacker_key` names the attacker
 * across entries: `uid:<uid>` for a player found in a tracked alliance's roster, else `name:<name key>`.
 */
export const thefts = pgTable(
  "thefts",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** When it happened (the report's server time, as an instant); null when the time was not read. */
    at: tstz("at"),
    attackerKey: text("attacker_key").notNull(),
    attackerUid: big("attacker_uid"),
    attackerName: text("attacker_name").notNull(),
    /** The attacker's alliance tag; "" when not known. */
    attackerTag: text("attacker_tag").notNull(),
    /** What the report says was taken; null when the report's sentence was unreadable. */
    stolen: text("stolen", { enum: ["quest_rewards"] }),
    /** The member it was taken from, in the workspace's own alliance; null when not known. */
    victimUid: big("victim_uid"),
    victimName: text("victim_name"),
    source: text("source", { enum: ["photo", "typed"] }).notNull(),
    note: text("note"),
    createdBy: integer("created_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    createdAt: tstz("created_at").notNull(),
  },
  (t) => [
    index("thefts_workspace_attacker_idx").on(t.workspaceId, t.attackerKey),
    check("thefts_stolen_check", sql`${t.stolen} is null or ${t.stolen} = 'quest_rewards'`),
    check("thefts_source_check", sql`${t.source} in ('photo', 'typed')`),
  ],
);

/**
 * "To follow up", per attacker (issue 321): every change an officer makes is a row (who and when), and the
 * newest row of an attacker is its state. No row means open.
 */
export const theftFollowUps = pgTable(
  "theft_follow_ups",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    attackerKey: text("attacker_key").notNull(),
    state: text("state", { enum: ["open", "talked", "resolved"] }).notNull(),
    note: text("note"),
    changedBy: integer("changed_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    changedAt: tstz("changed_at").notNull(),
  },
  (t) => [
    index("theft_follow_ups_workspace_attacker_idx").on(t.workspaceId, t.attackerKey, t.id),
    check("theft_follow_ups_state_check", sql`${t.state} in ('open', 'talked', 'resolved')`),
  ],
);
