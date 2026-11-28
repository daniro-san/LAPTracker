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
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
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

/**
 * An event's windows (D160): 1 to 4 stretches of game time, each with its own Before (`before_at`), After
 * (`after_at`) and the samples between them. Origin of Chaos has two. `events.before_at` is window 1's
 * Before and `events.after_at` the last window's After. Windows never overlap and keep their times once
 * created (D21). Only the tick and the collector read this table; readers use `snapshots.window_n` and
 * `snapshots.between_windows`.
 */
export const eventWindows = pgTable(
  "event_windows",
  {
    // Cascade: a pruned rehearsal (pruneRehearsals) takes its windows with it.
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    n: smallint("n").notNull(),
    beforeAt: tstz("before_at").notNull(),
    afterAt: tstz("after_at").notNull(),
  },
  (t) => [
    primaryKey({ name: "event_windows_pk", columns: [t.eventId, t.n] }),
    check("event_windows_n_check", sql`${t.n} between 1 and 4`),
  ],
);

export const snapshots = pgTable(
  "snapshots",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => events.id),
    // "sample": a reading between an event's Before and After, one per slot (D69).
    phase: text("phase", { enum: ["before", "after", "sample"] }).notNull(),
    /** A sample's slot (D69): the grid instant it was due at, UTC. Null on a Before or an After. */
    slotAt: tstz("slot_at"),
    /** The event window this row belongs to (D160): 1 on every one-window event. */
    windowN: smallint("window_n").notNull().default(1),
    /**
     * A Before or After between two windows of one event (D160): window 1's After, window 2's Before, and so
     * on. False on the event's Start (window 1's Before), its End (the last window's After) and on samples,
     * so `phaseSnapshot` keeps meaning "the event's Start or End".
     */
    betweenWindows: boolean("between_windows").notNull().default(false),
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
    // D1's guarantee per window (D160): one Before and one After per event window, one sample per slot
    // (windows never overlap, so a slot belongs to one window).
    uniqueIndex("snapshots_event_window_phase_unique")
      .on(t.eventId, t.windowN, t.phase)
      .where(sql`${t.phase} <> 'sample'`),
    uniqueIndex("snapshots_event_slot_unique")
      .on(t.eventId, t.slotAt)
      .where(sql`${t.phase} = 'sample'`),
    check("snapshots_phase_check", sql`${t.phase} in ('before', 'after', 'sample')`),
    check("snapshots_slot_check", sql`(${t.phase} = 'sample') = (${t.slotAt} is not null)`),
    check("snapshots_window_check", sql`${t.windowN} between 1 and 4`),
    check(
      "snapshots_between_check",
      sql`not ${t.betweenWindows} or (${t.phase} = 'after' or (${t.phase} = 'before' and ${t.windowN} > 1))`,
    ),
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
    // A sample's members (D69) as D60's parallel arrays; a null power or kills stays null (D15). Null on
    // Before and After rows, which keep member_snapshots and raw_json.
    memberUids: big("member_uids").array(),
    memberNames: text("member_names").array(),
    memberPower: big("member_power").array(),
    memberKills: big("member_kills").array(),
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
    // The avatar frame the player wore (5001 is the game's plain one); the page shows it via
    // /img/frame/[id] (D65). Null on rows stored before the column.
    frameId: integer("frame_id"),
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

/**
 * Each player's current avatar frame (D65): the frame from their newest read, whether an event snapshot or
 * the daily read, so a frame the player changes shows within a day. One row per player.
 */
export const playerFrames = pgTable("player_frames", {
  uid: big("uid").primaryKey(),
  frameId: integer("frame_id").notNull(),
  /** The upstream `updated_at` of the read the frame came from; a write only replaces an older one. */
  seenAt: tstz("seen_at").notNull(),
});

/** The "why" of every run (plan §6, Phase 6 "Observability"): counts and codes, never names. */
export const runLogs = pgTable(
  "run_logs",
  {
    id: serial("id").primaryKey(),
    /** The run a line belongs to: a snapshot, or a daily roster read (`read_day`, D60), never both. */
    snapshotId: integer("snapshot_id").references(() => snapshots.id),
    readDay: date("read_day", { mode: "string" }).references(() => dailyReads.day),
    at: tstz("at").notNull(),
    level: text("level", { enum: ["info", "warn", "error"] }).notNull(),
    code: text("code").notNull(),
    unionId: big("union_id"),
    data: jsonb("data").notNull(),
  },
  (t) => [
    index("run_logs_snapshot_id_idx").on(t.snapshotId),
    index("run_logs_read_day_idx").on(t.readDay),
    check("run_logs_level_check", sql`${t.level} in ('info', 'warn', 'error')`),
    check("run_logs_one_owner_check", sql`(${t.snapshotId} is null) <> (${t.readDay} is null)`),
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
    /** Under /w/[slug] or /api/w/[slug]: the request's slug when it has a slug's shape (/admin's Alliances
     * table counts errors by workspace, D144); null elsewhere. */
    workspaceSlug: text("workspace_slug"),
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
    /** D72: when the tick's automatic retry took this day; at most one per day. */
    autoRetryAt: tstz("auto_retry_at"),
  },
  (t) => [
    check(
      "daily_reads_status_check",
      sql`${t.status} in ('running', 'complete', 'partial', 'failed')`,
    ),
  ],
);

/**
 * One alliance's roster from a daily read (D60), or from "Get today's details" (D133): the members as four parallel arrays (uid, name, power,
 * kills; a null power or kills stays null, D15) that the member history reads, and the trimmed response
 * in raw_json (D72), which keeps every roster field (daily_tech among them) and which no read model,
 * route, page, log or message selects. Error rows and rows from before D72 have none.
 */
export const dailyRosters = pgTable(
  "daily_rosters",
  {
    id: serial("id").primaryKey(),
    // No foreign key to daily_reads since D133: "Get today's details" stores its roster here under a day the
    // daily read may not have claimed yet.
    readDay: date("read_day", { mode: "string" }).notNull(),
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
    rawJson: jsonb("raw_json"),
  },
  (t) => [
    unique("daily_rosters_day_union_unique").on(t.readDay, t.unionId),
    index("daily_rosters_union_idx").on(t.unionId),
    // One player's rows (`@>`, roster-stays.ts and player-progress.ts) and a set's (`&&`, member-history.ts
    // and sightingsElsewhere) without reading the whole table (issue 521).
    index("daily_rosters_member_uids_idx").using("gin", t.memberUids),
  ],
);

/**
 * A workspace (D71): the private area of one alliance. The Discord server and the leadership role ids
 * live here, so a new alliance needs no deploy; the owner registers one on /admin.
 */
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  unionId: big("union_id").notNull().unique(),
  /** One workspace per Discord server (D126): the Discord commands find the workspace by it. */
  discordGuildId: text("discord_guild_id").notNull().unique(),
  leaderRoleIds: text("leader_role_ids").array().notNull(),
  /** Members' board roles (D105, amended 2026-11-17): empty means no member session, the board is closed. */
  memberRoleIds: text("member_role_ids")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: tstz("created_at").notNull().defaultNow(),
  /**
   * "Delete this workspace" (D125): when it was asked, by which workspace user (null: the site's owner on
   * /admin; no foreign key, the row goes with the workspace), and the instant after which the daily job
   * deletes it, 14 days later. All three null: no deletion asked. Cancel clears them.
   */
  deletionRequestedAt: tstz("deletion_requested_at"),
  deletionRequestedBy: integer("deletion_requested_by"),
  purgeAfter: tstz("purge_after"),
});

/**
 * The people of one workspace (D71): a row is written when someone signs in, or when the owner puts a
 * Discord account on the allowlist (with who added it and until when).
 */
export const workspaceUsers = pgTable(
  "workspace_users",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    discordUserId: text("discord_user_id").notNull(),
    displayName: text("display_name"),
    allowlisted: boolean("allowlisted").notNull().default(false),
    allowlistAddedBy: text("allowlist_added_by"),
    allowlistExpiresAt: tstz("allowlist_expires_at"),
    blocked: boolean("blocked").notNull().default(false),
    lastLoginAt: tstz("last_login_at"),
    /** The name the officer chose in the profile sheet; null shows display_name (from Discord). */
    chosenName: text("chosen_name"),
    /** "This is me": the person's player in the workspace's own alliance; null when not linked. */
    playerUid: big("player_uid"),
    /**
     * D142: an officer's own link, or one an officer approved, is `approved`; every member's link is
     * `pending` until an officer approves it. Null exactly when `player_uid` is.
     */
    playerLink: text("player_link", { enum: ["approved", "pending"] }),
    playerLinkedAt: tstz("player_linked_at"),
  },
  (t) => [
    unique("workspace_users_workspace_discord_unique").on(t.workspaceId, t.discordUserId),
    // D142: one approved link per player in a workspace (one player per user is the row itself). Pending
    // claims reserve nothing, so a false claim never locks the real player out.
    uniqueIndex("workspace_users_player_unique")
      .on(t.workspaceId, t.playerUid)
      .where(sql`${t.playerLink} = 'approved'`),
    check(
      "workspace_users_player_link_check",
      sql`(${t.playerUid} is null) = (${t.playerLink} is null) and (${t.playerLink} is null or ${t.playerLink} in ('approved', 'pending'))`,
    ),
  ],
);

// Signed-in sessions (D71, D105), in their own file for size (D142).
export { workspaceSessions } from "./schema-sessions";

// The workspace calendar (issue 300), in its own file for size.
export * from "./schema-calendar";
// The Roll call tab (issue 298), in its own file for size.
export * from "./schema-rollcall";
// The workspace's member facts and remembered sheet names (D80), in their own file for size.
export { memberFacts, memberSelfReports, nameAliases, pendingMembers } from "./schema-facts";
// The Follow-up tab's officer actions (issue 340, D104), in their own file for size.
export { memberFollowUps } from "./schema-followup";
