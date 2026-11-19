// The thefts log's tables (issue 321, D97), apart from lib/schema.ts for its size. drizzle.config.ts lists
// both files.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
const big = (name: string) => bigint(name, { mode: "number" });

/**
 * One Secret Operations theft from a member of the workspace's alliance (issue 321): who took it (name and
 * alliance tag), whose it was, when, and where the entry came from. `attacker_key` names the attacker
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
    /**
     * The attacker is a player of a tracked alliance, picked by an officer or matched exactly on a screenshot
     * (the current name and the same tag), so on our server unless an officer says otherwise (D97, amended
     * 2026-11-19). A fuzzy or tagless match leaves it false.
     */
    rosterExact: boolean("roster_exact").notNull().default(false),
    /** The theft's type (D97, amended 2026-11-17); null on rows saved before the type was asked. */
    kind: text("kind", { enum: ["tile_hit", "ops", "caravan", "sanctuary"] }),
    /** The member it was taken from, in the workspace's own alliance; null when not known. */
    victimUid: big("victim_uid"),
    victimName: text("victim_name"),
    source: text("source", { enum: ["photo", "typed"] }).notNull(),
    /** What was taken, as the officer wrote it from the report (D97, amended 2026-11-19); null when not given. */
    items: text("items"),
    note: text("note"),
    createdBy: integer("created_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    createdAt: tstz("created_at").notNull(),
    /** The add sheet's request id (D100): a retry of the same add finds this row instead of a second. */
    requestId: text("request_id"),
    /**
     * Deleted (D123): who and when, under the delete question's request id (D100). A deleted theft leaves
     * the log, its counts, the Follow-up tab and Home. Undo clears `deleted_at`.
     */
    deletedAt: tstz("deleted_at"),
    deletedBy: integer("deleted_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    deleteRequestId: text("delete_request_id"),
  },
  (t) => [
    index("thefts_workspace_attacker_idx").on(t.workspaceId, t.attackerKey),
    index("thefts_workspace_created_idx").on(t.workspaceId, t.createdAt),
    uniqueIndex("thefts_request_unique").on(t.workspaceId, t.requestId),
    check(
      "thefts_kind_check",
      sql`${t.kind} is null or ${t.kind} in ('tile_hit', 'ops', 'caravan', 'sanctuary')`,
    ),
    check("thefts_source_check", sql`${t.source} in ('photo', 'typed')`),
  ],
);

/**
 * "To follow up", per attacker (issue 321), in steps: open, warned, talked, retaliated, resolved (D97,
 * amended 2026-11-19). Every change an officer makes is a row (who and when), and the
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
    state: text("state", {
      enum: ["open", "warned", "talked", "retaliated", "resolved"],
    }).notNull(),
    note: text("note"),
    changedBy: integer("changed_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    changedAt: tstz("changed_at").notNull(),
    /** The step's request id (D100): a retry of the same step finds this row instead of adding a second. */
    requestId: text("request_id"),
  },
  (t) => [
    index("theft_follow_ups_workspace_attacker_idx").on(t.workspaceId, t.attackerKey, t.id),
    uniqueIndex("theft_follow_ups_request_unique").on(t.workspaceId, t.requestId),
    check(
      "theft_follow_ups_state_check",
      sql`${t.state} in ('open', 'warned', 'talked', 'retaliated', 'resolved')`,
    ),
  ],
);

/**
 * An attacker's server as an officer set it (D97, amended 2026-11-19), one row per attacker, apart from the
 * entries so a deleted and restored entry cannot change it. `server` null: an officer said "not known".
 * No row: nothing set, and the server is inferred from an exact roster match, if any.
 */
export const theftAttackers = pgTable(
  "theft_attackers",
  {
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    attackerKey: text("attacker_key").notNull(),
    server: integer("server"),
    setBy: integer("set_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    setAt: tstz("set_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.attackerKey] })],
);
