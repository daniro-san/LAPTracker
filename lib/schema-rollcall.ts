// The Roll call tab's tables (issue 298, D103), split from lib/schema.ts for its size and re-exported there.
// A roll call is one occasion: a KvK shield check, an Undead Siege, plunders or an Elixir Scramble team.
// Each mark is one write of one member's answer, append-only with a version per member (D80's pattern), so
// two officers marking the same member cannot both win and the history keeps both. No mark is "not set",
// which never counts against anyone (D75).
import { sql } from "drizzle-orm";
import {
  bigint,
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
 * call per entry and week; it stays when the entry is deleted. Added by hand (KvK shield, Undead Siege,
 * plunders): no entry, `week` is the Monday of `day`, and the add sheet's request id (D100). `variant` is
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
  },
  (t) => [
    index("roll_calls_workspace_week_idx").on(t.workspaceId, t.week),
    uniqueIndex("roll_calls_entry_week_unique").on(t.entryId, t.week),
    uniqueIndex("roll_calls_request_unique").on(t.workspaceId, t.requestId),
    // One hand-added roll call per kind and day. Only rows added by hand carry a request id: a Calendar
    // roll call whose entry was deleted (entry_id set null) never collides with one, so the Calendar's
    // delete cannot fail on this index.
    uniqueIndex("roll_calls_added_unique")
      .on(t.workspaceId, t.kind, t.day)
      .where(sql`${t.requestId} is not null`),
    check("roll_calls_kind_check", sql`${t.kind} in ('shield', 'raid', 'plunder', 'elixir')`),
    check("roll_calls_variant_check", sql`${t.variant} in ('A', 'B')`),
  ],
);

/**
 * One write of one member's mark: `yes`, `no`, `assumed` ("no problem seen", the KvK shield's bulk
 * answer) or null (cleared). `version` counts that member's writes in that roll call.
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
    mark: text("mark"),
    writtenBy: integer("written_by").references(() => workspaceUsers.id, { onDelete: "set null" }),
    writtenAt: tstz("written_at").notNull(),
  },
  (t) => [
    unique("roll_call_marks_version_unique").on(t.rollCallId, t.uid, t.version),
    check("roll_call_marks_mark_check", sql`${t.mark} in ('yes', 'no', 'assumed')`),
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
