// Raid prep's Raid Shield check (issue 474, D137), apart from lib/schema.ts for its size; drizzle.config.ts
// lists this file too. The check reads every member twice on the night before KvK: Friday 23:30 server time
// (the squads queue's own read of that quota day, D132, run as one burst) and Saturday morning (its own
// queue here). The shield facts themselves stay in `player_reads` (D132). Counts, codes and uids only: no
// name, no shield value is stored here. Workspace-only data (D71): attack-relevant, never public.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { dailyReads, workspaces, workspaceUsers } from "./schema";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
const big = (name: string) => bigint(name, { mode: "number" });

/**
 * One alliance's Raid Shield check of one quota day (`day`: the daily read of that quota day, as
 * `squad_reads`, so Friday's server date). `night_at`: the first burst of Friday's read. The morning read's
 * claim, cost and stop reason, as `squad_reads` keeps the squads read's. `message_id`: the leaders'
 * channel message the morning read edits (D129's webhook), null before the first post.
 */
export const shieldChecks = pgTable(
  "shield_checks",
  {
    day: date("day", { mode: "string" })
      .notNull()
      .references(() => dailyReads.day),
    unionId: big("union_id").notNull(),
    nightAt: tstz("night_at"),
    morningStatus: text("morning_status", { enum: ["running", "done", "stopped", "skipped"] }),
    morningStartedAt: tstz("morning_started_at"),
    /** The morning batch holding the claim; older than 150 s was killed. */
    morningBatchAt: tstz("morning_batch_at"),
    morningFinishedAt: tstz("morning_finished_at"),
    morningCalls: integer("morning_calls").notNull().default(0),
    morningQuotaRemaining: integer("morning_quota_remaining"),
    morningReason: text("morning_reason"),
    messageId: text("message_id"),
    /**
     * The posted text's sha256, so an unchanged summary is not edited again; `gone` once Discord said the
     * message was deleted: it is never posted again that night.
     */
    messageHash: text("message_hash"),
    /**
     * The sha256 of the webhook the message went through (never the URL): a message is edited only through
     * the same webhook, so a channel changed since posts fresh (D147).
     */
    messageHook: text("message_hook"),
    postedAt: tstz("posted_at"),
  },
  (t) => [
    primaryKey({ name: "shield_checks_pk", columns: [t.day, t.unionId] }),
    check(
      "shield_checks_morning_status_check",
      sql`${t.morningStatus} in ('running', 'done', 'stopped', 'skipped')`,
    ),
  ],
);

/** The morning read's queue: one row per member, as D132's `squad_queue`. Uids only. */
export const shieldQueue = pgTable(
  "shield_queue",
  {
    day: date("day", { mode: "string" })
      .notNull()
      .references(() => dailyReads.day),
    unionId: big("union_id").notNull(),
    uid: big("uid").notNull(),
    state: text("state", { enum: ["waiting", "done", "failed"] })
      .notNull()
      .default("waiting"),
    attempts: integer("attempts").notNull().default(0),
    dueAt: tstz("due_at").notNull(),
  },
  (t) => [
    primaryKey({ name: "shield_queue_pk", columns: [t.day, t.unionId, t.uid] }),
    index("shield_queue_next_idx").on(t.day, t.unionId, t.state, t.dueAt),
    check("shield_queue_state_check", sql`${t.state} in ('waiting', 'done', 'failed')`),
  ],
);

/**
 * The alliance's own choices for the check (Alliance settings, officers only): the reads' times (minutes
 * after 00:00 server time: the night read 20:00 to 23:45, the morning read 10:00 to 11:00, the after-reset
 * check on or off and 00:15 to 10:15, issue 859), and whether the leaders' channel gets the summary, in
 * which language. No row: 23:30, 10:00, the after-reset check on at 02:30, and no Discord message. The raid
 * opponent's Start and End reads (issue 861, D165): minutes after 00:00 ST of Saturday and of Sunday, 00:00
 * to 02:00, 00:00 by default.
 */
export const shieldSettings = pgTable(
  "shield_settings",
  {
    workspaceId: integer("workspace_id")
      .primaryKey()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    morningMinute: integer("morning_minute").notNull().default(600),
    nightMinute: integer("night_minute").notNull().default(1410),
    resetRead: boolean("reset_read").notNull().default(true),
    resetMinute: integer("reset_minute").notNull().default(150),
    raidStartMinute: integer("raid_start_minute").notNull().default(0),
    raidEndMinute: integer("raid_end_minute").notNull().default(0),
    discord: boolean("discord").notNull().default(false),
    language: text("language").notNull().default("en"),
    updatedBy: integer("updated_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    updatedAt: tstz("updated_at").notNull(),
  },
  (t) => [
    check("shield_settings_minute_check", sql`${t.morningMinute} between 600 and 660`),
    check("shield_settings_night_check", sql`${t.nightMinute} between 1200 and 1425`),
    check("shield_settings_reset_check", sql`${t.resetMinute} between 15 and 615`),
    check("shield_settings_raid_start_check", sql`${t.raidStartMinute} between 0 and 120`),
    check("shield_settings_raid_end_check", sql`${t.raidEndMinute} between 0 and 120`),
    check("shield_settings_language_check", sql`${t.language} in ('en', 'pt-BR', 'fr')`),
  ],
);

/**
 * This week's raid opponent of a workspace (issue 861, D165): one alliance of any server, set in Raid prep
 * for the raid of `saturday` (its server date) and checked by one read on the alliance's own key. A change
 * or a clear keeps the old row with `cleared_at`, so Undo brings it back with no call; the current one has
 * none. Its tag and name are the tracker's answer. Workspace-only data (D71), never public.
 */
export const raidOpponents = pgTable(
  "raid_opponents",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    saturday: date("saturday", { mode: "string" }).notNull(),
    server: integer("server").notNull(),
    unionId: big("union_id").notNull(),
    tag: text("tag").notNull(),
    name: text("name"),
    setBy: integer("set_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    setAt: tstz("set_at").notNull(),
    clearedAt: tstz("cleared_at"),
  },
  (t) => [
    uniqueIndex("raid_opponents_current_unique")
      .on(t.workspaceId, t.saturday)
      .where(sql`${t.clearedAt} is null`),
    check("raid_opponents_server_check", sql`${t.server} between 1 and 9999`),
  ],
);

/**
 * One raid read (issue 861, D165): a side (`us`, `them`) at the Start or the End of the raid of `saturday`.
 * The row is claimed before the call (`error` "sent: no answer stored"), so no read is sent twice; a tick
 * that never came leaves no row, and that read is missing. Totals and the members as uid, might and kills
 * arrays: no name, no photo, no raw body.
 */
export const raidReads = pgTable(
  "raid_reads",
  {
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    saturday: date("saturday", { mode: "string" }).notNull(),
    phase: text("phase", { enum: ["start", "end"] }).notNull(),
    side: text("side", { enum: ["us", "them"] }).notNull(),
    unionId: big("union_id").notNull(),
    memberCount: integer("member_count"),
    totalPower: big("total_power"),
    totalKills: big("total_kills"),
    memberUids: big("member_uids").array(),
    memberPower: big("member_power").array(),
    memberKills: big("member_kills").array(),
    sourceUpdatedAt: tstz("source_updated_at"),
    isFresh: boolean("is_fresh").notNull().default(false),
    error: text("error"),
    readAt: tstz("read_at").notNull(),
  },
  (t) => [
    primaryKey({ name: "raid_reads_pk", columns: [t.workspaceId, t.saturday, t.phase, t.side] }),
    check("raid_reads_phase_check", sql`${t.phase} in ('start', 'end')`),
    check("raid_reads_side_check", sql`${t.side} in ('us', 'them')`),
  ],
);
