// Every alliance on the server, from the ranks board (D133, issue 459), apart from lib/schema.ts for its size;
// drizzle.config.ts lists this file too.
// - `alliances`: one row per alliance ever seen on the board, with its newest tag, name and emblem.
// - `alliance_board`: the board of each server day, one row per alliance: its might and kills as the board
//   shows them, and its places. The tag and name history of an alliance comes from these rows.
// - `tracked_sets`: the alliances read every day (the top TRACKED_COUNT by board might), one row per server day,
//   written once by the first tick of that day's read (the insert is the claim).
// - `alliance_lookups`: "Get today's details" for an alliance outside the daily read, one row per alliance and
//   server day (the insert is the claim), so the whole site makes at most one call per alliance a day.
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
const big = (name: string) => bigint(name, { mode: "number" });

export const alliances = pgTable("alliances", {
  unionId: big("union_id").primaryKey(),
  tag: text("tag"),
  name: text("name"),
  /** One of the preset emblems; served only via /img/badge/[id] (D22). */
  badgeId: integer("badge_id"),
  firstSeenDay: date("first_seen_day", { mode: "string" }).notNull(),
  lastSeenDay: date("last_seen_day", { mode: "string" }).notNull(),
});

export const allianceBoard = pgTable(
  "alliance_board",
  {
    day: date("day", { mode: "string" }).notNull(),
    unionId: big("union_id").notNull(),
    tag: text("tag"),
    name: text("name"),
    badgeId: integer("badge_id"),
    /** The board's might and its place; null when the alliance is on the kills board only. */
    power: big("power"),
    powerRank: integer("power_rank"),
    kills: big("kills"),
    killsRank: integer("kills_rank"),
    pulledAt: tstz("pulled_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.day, t.unionId] }),
    index("alliance_board_union_idx").on(t.unionId),
  ],
);

export const trackedSets = pgTable(
  "tracked_sets",
  {
    day: date("day", { mode: "string" }).primaryKey(),
    allianceIds: big("alliance_ids").array().notNull(),
    /** "board": the day's board; "previous": the board failed, the newest set is kept; "event": no set yet,
     * the newest event's list. */
    source: text("source", { enum: ["board", "previous", "event"] }).notNull(),
    createdAt: tstz("created_at").notNull(),
  },
  (t) => [check("tracked_sets_source_check", sql`${t.source} in ('board', 'previous', 'event')`)],
);

export const allianceLookups = pgTable(
  "alliance_lookups",
  {
    unionId: big("union_id").notNull(),
    day: date("day", { mode: "string" }).notNull(),
    claimedAt: tstz("claimed_at").notNull(),
    finishedAt: tstz("finished_at"),
    /** "running" while the calls are out; "done" with a roster stored; "refused": the quota rule (D117's reserve)
     * said no; "failed": a call failed. A "running" claim older than LOOKUP_STALE_AFTER_MS reads as failed. */
    status: text("status", { enum: ["running", "done", "refused", "failed"] }).notNull(),
    callsUsed: integer("calls_used").notNull().default(0),
    quotaRemaining: integer("quota_remaining"),
    /** A code ("quota", "v1 502"), never a message from upstream. */
    error: text("error"),
  },
  (t) => [
    primaryKey({ columns: [t.unionId, t.day] }),
    index("alliance_lookups_day_idx").on(t.day),
    check(
      "alliance_lookups_status_check",
      sql`${t.status} in ('running', 'done', 'refused', 'failed')`,
    ),
  ],
);
