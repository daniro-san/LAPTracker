// The Roll call tab's tables (issue 298, D103), split from lib/schema.ts for its size and re-exported there.
// A roll call is one occasion: a Raid Shield check, an Undead Siege, a Cheese Trap or an Elixir Scramble
// team; plunders were one until 2026-11-17 and the saved ones stay.
// Each mark is one write of one member's answer, append-only with a version per member (D80's pattern), so
// two officers marking the same member cannot both win and the history keeps both. No mark is "not set",
// which never counts against anyone (D75).
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
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspaces, workspaceUsers } from "./schema";
import { calendarEntries } from "./schema-calendar";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
const big = (name: string) => bigint(name, { mode: "number" });
const day = (name: string) => date(name, { mode: "string" });

/**
 * One occasion of a workspace. From the Calendar: `entry_id` and the plan's `week` (its Monday), one roll
 * call per entry and week; it stays when the entry is deleted. Added by hand (Raid Shield, Undead Siege,
 * Cheese Trap; plunders before 2026-11-17): no entry, `week` is the Monday of `day`, and the add sheet's request id (D100). `variant` is
 * an Elixir Scramble's team (A or B).
 */
export const rollCalls = pgTable(
  "roll_calls",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    variant: text("variant"),
    day: day("day").notNull(),
    week: day("week").notNull(),
    entryId: integer("entry_id").references(() => calendarEntries.id, { onDelete: "set null" }),
    requestId: text("request_id"),
    createdBy: integer("created_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    createdAt: tstz("created_at").notNull().defaultNow(),
    /**
     * Deleted (D120): who and when, under the delete question's request id (D100). A deleted roll call
     * leaves every list, count and Home; its marks never count. Undo clears `deleted_at`.
     */
    deletedAt: tstz("deleted_at"),
    deletedBy: integer("deleted_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    deleteRequestId: text("delete_request_id"),
    /** Archived (D120): off the week's list, under "Archived"; Unarchive clears both. */
    archivedAt: tstz("archived_at"),
    archivedBy: integer("archived_by").references(() => workspaceUsers.id, {
      onDelete: "set null",
    }),
    /**
     * Raid prep (D137, 2026-11-21): the newest tracker-written mark an officer saw when they pressed "Looks
     * right". Tracker marks written after it are still to check.
     */
    trackerCheckedAt: tstz("tracker_checked_at"),
  },
  (t) => [
    index("roll_calls_workspace_week_idx").on(t.workspaceId, t.week),
    // Live roll calls only (D120): after a delete, the Calendar occasion starts again empty.
    uniqueIndex("roll_calls_entry_week_unique")
      .on(t.entryId, t.week)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex("roll_calls_request_unique").on(t.workspaceId, t.requestId),
    // One hand-added roll call per kind and day. Only rows added by hand carry a request id: a Calendar
    // roll call whose entry was deleted (entry_id set null) never collides with one, so the Calendar's
    // delete cannot fail on this index.
    uniqueIndex("roll_calls_added_unique")
      .on(t.workspaceId, t.kind, t.day)
      .where(sql`${t.requestId} is not null and ${t.deletedAt} is null`),
    check(
      "roll_calls_kind_check",
      sql`${t.kind} in ('shield', 'raid', 'plunder', 'elixir', 'cheese')`,
    ),
    check("roll_calls_variant_check", sql`${t.variant} in ('A', 'B')`),
  ],
);

/**
 * One write of one member's mark: `yes`, `no`, `assumed` ("no problem seen", the Raid Shield's bulk
 * answer) or null (cleared). `version` counts that member's writes in that roll call and `part`. `part` is
 * `main` (the roll call's own mark) or, on Raid prep (D137), `wall`: squads off the wall. `by_tracker`: written
 * by the tick from the Raid Shield check's reading (D137, 2026-11-21), with no officer; an officer's write
 * of the same member is the next version, their own.
 */
export const rollCallMarks = pgTable(
  "roll_call_marks",
  {
    id: serial("id").primaryKey(),
    rollCallId: integer("roll_call_id")
      .notNull()
      .references(() => rollCalls.id, { onDelete: "cascade" }),
    uid: big("uid").notNull(),
    version: integer("version").notNull(),
    part: text("part", { enum: ["main", "wall"] })
      .notNull()
      .default("main"),
    mark: text("mark"),
    writtenBy: integer("written_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    writtenAt: tstz("written_at").notNull(),
    byTracker: boolean("by_tracker").notNull().default(false),
    /** An Elixir Scramble Joined mark's optional score (issue 468). */
    score: integer("score"),
    /** Written by "the rest", not tapped by an officer: an assumption, never an explicit mark (issue 468). */
    byRest: boolean("by_rest").notNull().default(false),
  },
  (t) => [
    unique("roll_call_marks_version_unique").on(t.rollCallId, t.uid, t.part, t.version),
    // Home's recent activity (D108) reads the marks of the last two weeks.
    index("roll_call_marks_written_idx").on(t.writtenAt),
    // /admin's "first roll call marked" (D145): each roll call's first mark from the index alone (D149).
    index("roll_call_marks_call_written_idx").on(t.rollCallId, t.writtenAt),
    // Issue 468: an Elixir Scramble team also takes registered, early (registered for 09:00 only), sub, excused.
    check(
      "roll_call_marks_mark_check",
      sql`${t.mark} in ('yes', 'no', 'assumed', 'registered', 'early', 'sub', 'excused')`,
    ),
    check("roll_call_marks_score_check", sql`${t.score} is null or ${t.score} >= 0`),
    check("roll_call_marks_part_check", sql`${t.part} in ('main', 'wall')`),
  ],
);

/** An Elixir Scramble team's members (up to 20), with the name they had when picked. */
export const rollCallTeam = pgTable(
  "roll_call_team",
  {
    rollCallId: integer("roll_call_id")
      .notNull()
      .references(() => rollCalls.id, { onDelete: "cascade" }),
    uid: big("uid").notNull(),
    name: text("name").notNull(),
    addedBy: integer("added_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    addedAt: tstz("added_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.rollCallId, t.uid] })],
);

/**
 * An Elixir Scramble team's result for its week (issue 468): the opponent and both scores. Won or Lost is
 * read from the two scores, never stored. One row per roll call, written by an officer.
 */
export const rollCallResults = pgTable(
  "roll_call_results",
  {
    rollCallId: integer("roll_call_id")
      .primaryKey()
      .references(() => rollCalls.id, { onDelete: "cascade" }),
    opponent: text("opponent"),
    ourScore: big("our_score"),
    theirScore: big("their_score"),
    writtenBy: integer("written_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    writtenAt: tstz("written_at").notNull(),
  },
  (t) => [
    check(
      "roll_call_results_scores_check",
      sql`(${t.ourScore} is null or ${t.ourScore} >= 0) and (${t.theirScore} is null or ${t.theirScore} >= 0)`,
    ),
  ],
);
