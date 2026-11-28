// The workspace calendar's tables (issue 300, D71), split from lib/schema.ts for its size and re-exported
// there. An entry is one plan: a one-off on its day, or a weekly repeat from its first week. Each week of an
// entry can carry its own row: a move to another day or time, a cancel, and the Alliance Caravan's picks.
// Every edit is field-level: `edits` keeps, per field, the version, who and when, for the 409 check (issue 293).
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";
import { notices } from "./schema-notices";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
const big = (name: string) => bigint(name, { mode: "number" });
const day = (name: string) => date(name, { mode: "string" });

/** Per field: its version (the row's `rev` when it was written), who wrote it and when (ISO). */
export type FieldEdits = Record<string, { v: number; by: number | null; at: string }>;

/**
 * One calendar entry of a workspace. `day` is its first server day and `minute` its server time (minutes
 * after midnight; none for the week's Alliance Duel theme). A one-off has `last_week` = the Monday of
 * its own week; a weekly entry runs from its first week to `last_week`, or on and on while it is null.
 * `for_members` is off until an officer switches it on (the members' board, issue 331, reads it later).
 */
export const calendarEntries = pgTable(
  "calendar_entries",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    /** Cheese Trap I or II; Elixir Scramble team A or B. */
    variant: text("variant"),
    level: smallint("level"),
    title: text("title"),
    notes: text("notes"),
    link: text("link"),
    day: day("day").notNull(),
    minute: smallint("minute"),
    weekly: boolean("weekly").notNull().default(false),
    lastWeek: day("last_week"),
    forMembers: boolean("for_members").notNull().default(false),
    createdBy: integer("created_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    createdAt: tstz("created_at").notNull().defaultNow(),
    rev: integer("rev").notNull().default(0),
    edits: jsonb("edits").$type<FieldEdits>().notNull().default({}),
    /** The add sheet's request id (D100): a retry of the same add finds this entry instead of a second. */
    requestId: text("request_id"),
    /** The notice that goes with this entry (D102), linked from either side; cleared when it is deleted. */
    noticeId: integer("notice_id").references(() => notices.id, { onDelete: "set null" }),
    /**
     * Deleted (D123): who and when, under the delete question's request id (D100). A deleted entry leaves
     * the Calendar, the board, Home and every other read; its rows stay. Undo clears `deleted_at`.
     */
    deletedAt: tstz("deleted_at"),
    deletedBy: integer("deleted_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    deleteRequestId: text("delete_request_id"),
  },
  (t) => [
    index("calendar_entries_workspace_day_idx").on(t.workspaceId, t.day),
    uniqueIndex("calendar_entries_request_unique").on(t.workspaceId, t.requestId),
    // One live Alliance Duel theme per week: a deleted one frees its week (D123).
    uniqueIndex("calendar_entries_duel_week_unique")
      .on(t.workspaceId, t.day)
      .where(sql`${t.kind} = 'duel' and ${t.deletedAt} is null`),
    check(
      "calendar_entries_kind_check",
      sql`${t.kind} in ('caravan', 'cheese', 'undead', 'elixir', 'kvk', 'duel', 'other')`,
    ),
    check("calendar_entries_minute_check", sql`${t.minute} between 0 and 1439`),
    check("calendar_entries_time_check", sql`(${t.minute} is null) = (${t.kind} = 'duel')`),
    check("calendar_entries_level_check", sql`${t.level} between 1 and 99`),
    check("calendar_entries_variant_check", sql`${t.variant} in ('I', 'II', 'A', 'B')`),
  ],
);

/**
 * One week of an entry, written only when that week differs from the plan: moved (`day` and `minute`),
 * cancelled, or an Alliance Caravan's picks. `week` is the Monday of the week the plan puts it in, so a
 * moved week keeps its picks. The caravan's second seat is one kind and one member: a VIP or a Guardian,
 * never both.
 */
export const calendarOccurrences = pgTable(
  "calendar_occurrences",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => calendarEntries.id, { onDelete: "cascade" }),
    week: day("week").notNull(),
    day: day("day"),
    minute: smallint("minute"),
    cancelled: boolean("cancelled").notNull().default(false),
    coachUid: big("coach_uid"),
    coachName: text("coach_name"),
    secondKind: text("second_kind"),
    secondUid: big("second_uid"),
    secondName: text("second_name"),
    rev: integer("rev").notNull().default(0),
    edits: jsonb("edits").$type<FieldEdits>().notNull().default({}),
  },
  (t) => [
    unique("calendar_occurrences_entry_week_unique").on(t.entryId, t.week),
    index("calendar_occurrences_workspace_day_idx").on(t.workspaceId, t.day),
    check("calendar_occurrences_moved_check", sql`(${t.day} is null) = (${t.minute} is null)`),
    check("calendar_occurrences_minute_check", sql`${t.minute} between 0 and 1439`),
    // A VIP or a Guardian, never both: one kind, one member, one name, all set or all empty.
    check(
      "calendar_occurrences_second_check",
      sql`(${t.secondKind} is null) = (${t.secondUid} is null) and (${t.secondUid} is null) = (${t.secondName} is null) and (${t.secondKind} is null or ${t.secondKind} in ('vip', 'guardian'))`,
    ),
    check(
      "calendar_occurrences_coach_check",
      sql`(${t.coachUid} is null) = (${t.coachName} is null)`,
    ),
    check(
      "calendar_occurrences_two_people_check",
      sql`${t.coachUid} is null or ${t.secondUid} is null or ${t.coachUid} <> ${t.secondUid}`,
    ),
  ],
);

/** One garrison pair (D121): the helper's spare squad (its number) lent to one member. */
export interface GarrisonPair {
  helper: number;
  squad: number;
  member: number;
}

/** One save of a siege's enemy might (D121): the value in full, who saved it and when (ISO). */
export interface EnemyMightSave {
  value: number;
  by: number;
  at: string;
}

/**
 * One Undead Siege (an entry's week, the plan's Monday, as a roll call's) and its garrison plan (D121).
 * The enemy might is this siege's own: `enemy_rev` counts its saves for the 409 check, and every save is
 * appended to `enemy_history`. `pairs` is null while the plan is the suggestion; `rev` counts its saves.
 * The post to Discord is claimed here once per request id (D100); `post_status` is posting, posted or
 * failed, and `post_channel` the channel chosen.
 */
export const garrisonPlans = pgTable(
  "garrison_plans",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => calendarEntries.id, { onDelete: "cascade" }),
    week: day("week").notNull(),
    enemyMight: big("enemy_might"),
    enemyRev: integer("enemy_rev").notNull().default(0),
    enemyHistory: jsonb("enemy_history").$type<EnemyMightSave[]>().notNull().default([]),
    pairs: jsonb("pairs").$type<GarrisonPair[]>(),
    /** The enemy might the pairs were saved at: a later change of it asks to start again. */
    pairsEnemyMight: big("pairs_enemy_might"),
    rev: integer("rev").notNull().default(0),
    /** The officer's last save of the pairs; null for a plan stored only to post the suggestion. */
    savedBy: integer("saved_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    savedAt: tstz("saved_at"),
    postRequestId: text("post_request_id"),
    postStatus: text("post_status"),
    postChannel: text("post_channel"),
    postedBy: integer("posted_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    postedAt: tstz("posted_at"),
  },
  (t) => [
    unique("garrison_plans_entry_week_unique").on(t.entryId, t.week),
    index("garrison_plans_workspace_idx").on(t.workspaceId),
    check(
      "garrison_plans_post_status_check",
      sql`${t.postStatus} in ('posting', 'posted', 'failed')`,
    ),
    check("garrison_plans_post_channel_check", sql`${t.postChannel} in ('members', 'leaders')`),
    check("garrison_plans_enemy_might_check", sql`${t.enemyMight} > 0`),
  ],
);

/** One role of a KvK plan (D161): its name as the officers wrote it and the members in it, by uid. */
export interface KvkRole {
  name: string;
  uids: number[];
}

/**
 * A KvK calendar entry's plan (D161): the roles in the officers' order, their note, `rev` for the 409 check,
 * who saved last and when, and the last notice made from it ("Make the message"). One row per entry; a
 * weekly KvK keeps one plan for every week.
 */
export const kvkPlans = pgTable(
  "kvk_plans",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => calendarEntries.id, { onDelete: "cascade" }),
    roles: jsonb("roles").$type<KvkRole[]>().notNull().default([]),
    note: text("note").notNull().default(""),
    rev: integer("rev").notNull().default(0),
    savedBy: integer("saved_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    savedAt: tstz("saved_at"),
    noticeId: integer("notice_id").references(() => notices.id, { onDelete: "set null" }),
  },
  (t) => [
    unique("kvk_plans_entry_unique").on(t.entryId),
    index("kvk_plans_workspace_idx").on(t.workspaceId),
  ],
);

/**
 * A member's "I'm in" for one role of a KvK plan (issue 831, D161 amended): asked, not yet answered. The
 * role is named as the plan names it; the uid is the member's approved link's (D142), never the request's.
 * An officer's Confirm puts the uid into the plan's role and deletes the row; Decline and the member's
 * Withdraw delete it. One row per entry, role and uid.
 */
export const kvkClaims = pgTable(
  "kvk_claims",
  {
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    entryId: integer("entry_id")
      .notNull()
      .references(() => calendarEntries.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    uid: big("uid").notNull(),
    askedAt: tstz("asked_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.entryId, t.role, t.uid] }),
    index("kvk_claims_workspace_idx").on(t.workspaceId),
  ],
);
