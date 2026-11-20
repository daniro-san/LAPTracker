// The squads from the tracker (D117, issue 413), apart from lib/schema.ts for its size; drizzle.config.ts
// lists this file too. Squads are workspace-only data of the own alliance (D71): read by lib/private for
// that workspace's card, written by the squads read. D132: the read's daily queue (`squad_queue`) and
// every /v1/players answer it gets (`player_reads`, `player_history`), from the same call.
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { dailyReads } from "./schema";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
const big = (name: string) => bigint(name, { mode: "number" });

/** A hero of a stored squad: the fields /v1/players sends, nothing else. */
export interface StoredHero {
  id: number;
  lv: number | null;
  star: number | null;
  q: number | null;
  awaken: number | null;
  /** The hero's Hall of Honor level (owner, 2026-11-20; D132); absent on rows stored before it. */
  honor?: number | null;
}

/** One troop kind in a squad (D132): its type id, tier and count. Stored, never shown (owner, #461). */
export interface StoredTroop {
  id: number;
  tier: number | null;
  n: number | null;
}

/**
 * One squad as the tracker saw it, append-only by read: a read adds a row only when the squad differs
 * from the newest stored row of that member and squad number (another `seen_at`, power or heroes). A
 * squad missing from a later response is never deleted.
 */
export const memberSquads = pgTable(
  "member_squads",
  {
    id: serial("id").primaryKey(),
    unionId: big("union_id").notNull(),
    uid: big("uid").notNull(),
    squad: integer("squad").notNull(),
    power: big("power").notNull(),
    soldiers: big("soldiers"),
    soldierLoad: big("soldier_load"),
    heroes: jsonb("heroes").$type<StoredHero[]>().notNull(),
    /** D132: the squad's troops as the tracker sent them; null on rows stored before. */
    troops: jsonb("troops").$type<StoredTroop[]>(),
    /** The tracker's `seen_at`; null when it sent none. */
    seenAt: tstz("seen_at"),
    /** Our read that stored this row. */
    readAt: tstz("read_at").notNull(),
  },
  (t) => [index("member_squads_member_idx").on(t.unionId, t.uid, t.squad)],
);

/**
 * The squads read of one quota day and alliance (D117; D124: one per workspace with a key, each on its
 * own key and quota; D132: `day` is the daily read of that quota day, its members in `squad_queue`): the
 * claim, what it cost and why it paused or stopped. Counts and codes only: no names, no squad values.
 */
export const squadReads = pgTable(
  "squad_reads",
  {
    day: date("day", { mode: "string" })
      .notNull()
      .references(() => dailyReads.day),
    unionId: big("union_id").notNull(),
    status: text("status", { enum: ["running", "done", "stopped", "skipped"] }).notNull(),
    startedAt: tstz("started_at").notNull(),
    /** When the batch running now (or the last one) took the day; a batch older than 150 s was killed. */
    batchAt: tstz("batch_at"),
    finishedAt: tstz("finished_at"),
    /** Members in the day's roster when the queue was made; members who join later are added to the queue. */
    members: integer("members").notNull(),
    callsUsed: integer("calls_used").notNull().default(0),
    withSquads: integer("with_squads").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    /** The quota left after the newest call (or the estimate the run started from). */
    quotaRemaining: integer("quota_remaining"),
    /** Why it was skipped or stopped, or why a running read waits (`quota`: the reserve): a code. */
    reason: text("reason"),
  },
  (t) => [
    primaryKey({ name: "squad_reads_day_union_pk", columns: [t.day, t.unionId] }),
    check(
      "squad_reads_status_check",
      sql`${t.status} in ('running', 'done', 'stopped', 'skipped')`,
    ),
  ],
);

/** The tracker's hero catalog (`/static/heroes.json`): id and name, refreshed at most once a day. */
export const heroCatalog = pgTable("hero_catalog", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  updatedAt: tstz("updated_at").notNull(),
});

/**
 * The day's squads queue (D132, issue 472): one row per member of the alliance and quota day. A batch takes
 * the members `waiting` whose `due_at` has come, oldest first. A 5xx or no answer puts the member at the
 * back (`due_at` later, `attempts` + 1) until 3 attempts; an answer makes it `done`. Uids only.
 */
export const squadQueue = pgTable(
  "squad_queue",
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
    primaryKey({ name: "squad_queue_pk", columns: [t.day, t.unionId, t.uid] }),
    index("squad_queue_next_idx").on(t.day, t.unionId, t.state, t.dueAt),
    check("squad_queue_state_check", sql`${t.state} in ('waiting', 'done', 'failed')`),
  ],
);

/**
 * Every /v1/players answer of the squads read (D132, issue 490), under the alliance whose workspace read
 * it. `raw_json` is the body less `alliance_members` (the daily roster has it, D72), cleared after 90
 * days; the columns stay. x, y, online, last_online_at and avatar_url stay inside raw_json only: no column,
 * query, log or download carries them (D71, D22). `player_union_id` is the alliance the body names.
 */
export const playerReads = pgTable(
  "player_reads",
  {
    id: serial("id").primaryKey(),
    unionId: big("union_id").notNull(),
    uid: big("uid").notNull(),
    readAt: tstz("read_at").notNull(),
    rawJson: jsonb("raw_json"),
    shielding: integer("shielding"),
    shieldType: integer("shield_type"),
    mapUpdatedAt: tstz("map_updated_at"),
    lastSeenAt: tstz("last_seen_at"),
    language: text("language"),
    power: big("power"),
    kills: big("kills"),
    playerUnionId: big("player_union_id"),
    sid: integer("sid"),
    homeSid: integer("home_sid"),
    vip: integer("vip"),
  },
  (t) => [
    index("player_reads_member_idx").on(t.unionId, t.uid, t.readAt),
    index("player_reads_read_at_idx").on(t.readAt),
  ],
);

/**
 * A player's `history[]` rows (D132): one row per alliance, member and `t` (the row's `observed_at`), so
 * overlapping reads add only the new ones. Might, kills, level, VIP and the alliance at that time; never
 * x or y.
 */
export const playerHistory = pgTable(
  "player_history",
  {
    unionId: big("union_id").notNull(),
    uid: big("uid").notNull(),
    t: tstz("t").notNull(),
    power: big("power"),
    kills: big("kills"),
    level: integer("level"),
    vip: integer("vip"),
    playerUnionId: big("player_union_id"),
    unionAbbr: text("union_abbr"),
    sid: integer("sid"),
    changeFlags: text("change_flags"),
    nick: text("nick"),
  },
  (t) => [primaryKey({ name: "player_history_pk", columns: [t.unionId, t.uid, t.t] })],
);
