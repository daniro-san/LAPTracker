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
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";

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
  },
  (t) => [
    index("calendar_entries_workspace_day_idx").on(t.workspaceId, t.day),
    uniqueIndex("calendar_entries_request_unique").on(t.workspaceId, t.requestId),
    // One Alliance Duel theme per week.
    uniqueIndex("calendar_entries_duel_week_unique")
      .on(t.workspaceId, t.day)
      .where(sql`${t.kind} = 'duel'`),
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
