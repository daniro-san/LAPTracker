// Drizzle schema for plan §6.
// Deviations from §6, each forced by another decision:
// - member_snapshots.power/kills are nullable: a null from upstream stays null (docs/decisions/D15).
// - alliance_snapshots data columns are nullable for error rows, which have no data (owner, Session 3).
// - events.event_at_utc is unique and events.quota_checked_at exists, so a double tick can create
//   neither two events nor two Friday checks (Session 4, docs/decisions/D20).
// - snapshots.quota_remaining_before and rehearsal_slots serve the rehearsal (plan §3.1, D20).
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
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
// Ids and totals exceed 2^31 (uids ~4.6e11, power ~4e9) but stay far below 2^53.
const big = (name: string) => bigint(name, { mode: "number" });

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    eventAtUtc: tstz("event_at_utc").notNull(),
    // INVARIANT event.after-uses-event-copy: written by the BEFORE run, read by the AFTER run.
    allianceIds: big("alliance_ids").array().notNull(),
    isTest: boolean("is_test").notNull().default(false),
    // D28: created from /admin, run only by its buttons; the tick and the delta chains skip it.
    manual: boolean("manual").notNull().default(false),
    // Manual rounds only (D28): "admin" never public, "standalone" public but outside the
    // comparison chains, "history" public and part of them. Real events keep the default.
    visibility: text("visibility", { enum: ["admin", "standalone", "history"] })
      .notNull()
      .default("standalone"),
    // Manual rounds only: post the public Discord message when a run finishes.
    postPublic: boolean("post_public").notNull().default(false),
    // D31: the one Discord message of this event in each channel, edited by the next phase.
    discordPublicMessageId: text("discord_public_message_id"),
    discordAdminMessageId: text("discord_admin_message_id"),
    createdAt: tstz("created_at").notNull().defaultNow(),
    // When each phase is due (plan §3.1). Scheduled events: SNAPSHOT_BEFORE/AFTER in SERVER_TZ;
    // rehearsals: created + 15 / + 45 min. The tick reads these, not the env.
    beforeAt: tstz("before_at").notNull(),
    afterAt: tstz("after_at").notNull(),
    // INVARIANT tick.friday-check-once: claimed by a conditional update, like the run lock.
    quotaCheckedAt: tstz("quota_checked_at"),
  },
  (t) => [unique("events_event_at_utc_unique").on(t.eventAtUtc)],
);

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
    // The quota check's `remaining` (that response already counts its own call). With
    // quota_remaining_after it gives the run's quota drop, which the rehearsal verdict checks.
    quotaRemainingBefore: integer("quota_remaining_before"),
    quotaRemainingAfter: integer("quota_remaining_after"),
    // Attempts counted after the response that gave quota_remaining_after: they carried no quota
    // object (a 5xx before the internal fallback), so the drop cannot show them.
    quotaUnseenCalls: integer("quota_unseen_calls").notNull().default(0),
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
    // The most members the alliance can hold, as /v1 reports it (100 today, the game may raise it);
    // null on rows stored before this column existed and on rows from the internal source.
    capacity: integer("capacity"),
    totalPower: big("total_power"),
    totalKills: big("total_kills"),
    serverRank: integer("server_rank"),
    level: integer("level"),
    // The emblem the leader picked (101–110 seen); the page shows it via /img/badge/[id] (D22).
    badgeId: integer("badge_id"),
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
    // Never returned by a query: /img/avatar/[uid] fetches it server-side (D22, plan §12.1).
    avatarUrl: text("avatar_url"),
    // The member's rank as /v1 reports it (105 = R5, 104 = R4, 103..101 = R3..R1) and its label
    // ("R4 · Diplomat"); null on rows stored before these columns and on rows from the internal source.
    rankCode: integer("rank_code"),
    rankLabel: text("rank_label"),
  },
  (t) => [
    unique("member_snapshots_alliance_uid_unique").on(t.allianceSnapshotId, t.uid),
    index("member_snapshots_uid_idx").on(t.uid),
  ],
);

/** The "why" of every run (plan §6, Phase 6 "Observability"): counts and codes, never names. */
export const runLogs = pgTable(
  "run_logs",
  {
    id: serial("id").primaryKey(),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => snapshots.id),
    at: tstz("at").notNull(),
    level: text("level", { enum: ["info", "warn", "error"] }).notNull(),
    code: text("code").notNull(),
    unionId: big("union_id"),
    data: jsonb("data").notNull(),
  },
  (t) => [
    index("run_logs_snapshot_id_idx").on(t.snapshotId),
    check("run_logs_level_check", sql`${t.level} in ('info', 'warn', 'error')`),
  ],
);

/** Rate limiter state (plan §12.2): keys 'ip:<addr>' and 'global'. Pruned on write. */
export const authAttempts = pgTable("auth_attempts", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: tstz("window_start").notNull(),
});

/** Errors outside a run (plan §6). Capped at 500 rows by the insert. */
export const appErrors = pgTable(
  "app_errors",
  {
    id: serial("id").primaryKey(),
    at: tstz("at").notNull(),
    route: text("route").notNull(),
    digest: text("digest"),
    message: text("message").notNull(),
    /** D61: the error's name, message, stack start and cause, redacted; shown on /admin/errors only. */
    detail: jsonb("detail"),
  },
  (t) => [index("app_errors_at_idx").on(t.at)],
);

/** The last alert of each kind (plan §6 Observability; id 1 app error, id 2 tick silence, D45),
 * claimed so one instance posts per hour. */
export const appAlerts = pgTable("app_alerts", {
  id: integer("id").primaryKey(),
  alertedAt: tstz("alerted_at").notNull(),
});

/** One row per authorised tick (D45): written before the tick's work, so a killed function leaves
 * a row with no finished_at. Capped at MAX_TICK_LOG rows (lib/repo/ticks.ts). */
export const tickLog = pgTable("tick_log", {
  id: serial("id").primaryKey(),
  startedAt: tstz("started_at").notNull(),
  finishedAt: tstz("finished_at"),
  outcome: text("outcome"),
});

/**
 * One row per REHEARSAL_AT occurrence (plan §3.1): the first tick in the slot's window claims it,
 * so a slot creates at most one rehearsal, or is skipped once with one admin note.
 */
export const rehearsalSlots = pgTable("rehearsal_slots", {
  slotAt: tstz("slot_at").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "set null" }),
  outcome: text("outcome").notNull(),
});

/**
 * One row per server day: the tick's daily roster read (D60). The insert is the claim, so two ticks
 * cannot both read; the row carries the outcome (run_logs needs a snapshot, which a daily read is not).
 */
export const dailyReads = pgTable(
  "daily_reads",
  {
    day: date("day", { mode: "string" }).primaryKey(),
    startedAt: tstz("started_at").notNull(),
    finishedAt: tstz("finished_at"),
    status: text("status", { enum: ["running", "complete", "partial", "failed"] }).notNull(),
    callsUsed: integer("calls_used").notNull().default(0),
    quotaRemainingBefore: integer("quota_remaining_before"),
    error: text("error"),
  },
  (t) => [
    check(
      "daily_reads_status_check",
      sql`${t.status} in ('running', 'complete', 'partial', 'failed')`,
    ),
  ],
);

/**
 * One alliance's roster from a daily read (D60): the members as four parallel arrays (uid, name, power,
 * kills; a null power or kills stays null, D15), no raw_json, so no blocked roster key is ever stored.
 */
export const dailyRosters = pgTable(
  "daily_rosters",
  {
    id: serial("id").primaryKey(),
    readDay: date("read_day", { mode: "string" })
      .notNull()
      .references(() => dailyReads.day),
    unionId: big("union_id").notNull(),
    tag: text("tag"),
    name: text("name"),
    memberCount: integer("member_count"),
    totalPower: big("total_power"),
    totalKills: big("total_kills"),
    badgeId: integer("badge_id"),
    sourceUpdatedAt: tstz("source_updated_at"),
    isFresh: boolean("is_fresh").notNull(),
    error: text("error"),
    /** D61: what the upstream answered for a failed alliance (UpstreamDetail), redacted; /admin only. */
    errorDetail: jsonb("error_detail"),
    memberUids: big("member_uids").array().notNull(),
    memberNames: text("member_names").array().notNull(),
    memberPower: big("member_power").array().notNull(),
    memberKills: big("member_kills").array().notNull(),
  },
  (t) => [
    unique("daily_rosters_day_union_unique").on(t.readDay, t.unionId),
    index("daily_rosters_union_idx").on(t.unionId),
  ],
);
