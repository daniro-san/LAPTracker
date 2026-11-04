// Drizzle schema for plan §6 (events, snapshots, alliance_snapshots, member_snapshots).
// Deviations from §6, both forced by other decisions:
// - member_snapshots.power/kills are nullable: a null from upstream stays null (DECISIONS D15).
// - alliance_snapshots data columns are nullable for error rows, which have no data (owner, Session 3).
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
// Ids and totals exceed 2^31 (uids ~4.6e11, power ~4e9) but stay far below 2^53.
const big = (name: string) => bigint(name, { mode: "number" });

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  eventAtUtc: tstz("event_at_utc").notNull(),
  // INVARIANT event.after-uses-event-copy: written by the BEFORE run, read by the AFTER run.
  allianceIds: big("alliance_ids").array().notNull(),
  isTest: boolean("is_test").notNull().default(false),
  createdAt: tstz("created_at").notNull().defaultNow(),
});

export const snapshots = pgTable(
  "snapshots",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id),
    phase: text("phase", { enum: ["before", "after"] }).notNull(),
    startedAt: tstz("started_at").notNull(),
    finishedAt: tstz("finished_at"),
    status: text("status", { enum: ["running", "complete", "partial", "failed"] }).notNull(),
    callsUsed: integer("calls_used").notNull().default(0),
    quotaRemainingAfter: integer("quota_remaining_after"),
    boardPulledAt: tstz("board_pulled_at"),
    error: text("error"),
    durationMs: integer("duration_ms"),
  },
  (t) => [
    unique("snapshots_event_phase_unique").on(t.eventId, t.phase),
    check("snapshots_phase_check", sql`${t.phase} in ('before', 'after')`),
    check(
      "snapshots_status_check",
      sql`${t.status} in ('running', 'complete', 'partial', 'failed')`,
    ),
  ],
);

export const allianceSnapshots = pgTable(
  "alliance_snapshots",
  {
    id: serial("id").primaryKey(),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => snapshots.id),
    unionId: big("union_id").notNull(),
    tag: text("tag"),
    name: text("name"),
    memberCount: integer("member_count"),
    totalPower: big("total_power"),
    totalKills: big("total_kills"),
    serverRank: integer("server_rank"),
    level: integer("level"),
    powerBoard: big("power_board"),
    killsBoard: big("kills_board"),
    source: text("source", { enum: ["v1", "internal"] }).notNull(),
    sourceUpdatedAt: tstz("source_updated_at"),
    cached: boolean("cached"),
    isFresh: boolean("is_fresh").notNull(),
    error: text("error"),
    rawJson: jsonb("raw_json"),
  },
  (t) => [
    unique("alliance_snapshots_snapshot_union_unique").on(t.snapshotId, t.unionId),
    check("alliance_snapshots_source_check", sql`${t.source} in ('v1', 'internal')`),
  ],
);

export const memberSnapshots = pgTable(
  "member_snapshots",
  {
    id: serial("id").primaryKey(),
    allianceSnapshotId: integer("alliance_snapshot_id")
      .notNull()
      .references(() => allianceSnapshots.id),
    uid: big("uid").notNull(),
    name: text("name").notNull(),
    power: big("power"),
    kills: big("kills"),
    lv: integer("lv"),
  },
  (t) => [
    unique("member_snapshots_alliance_uid_unique").on(t.allianceSnapshotId, t.uid),
    index("member_snapshots_uid_idx").on(t.uid),
  ],
);
