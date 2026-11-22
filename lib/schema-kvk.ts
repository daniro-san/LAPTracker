// The KvK opponent (D152, issue 306): the server our server meets in a scheduled event, with the alliance tags
// the owner types on /admin, and the opponent's alliances read at the event's Start and End. Apart from
// lib/schema.ts for its size; drizzle.config.ts lists this file.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { snapshots } from "./schema";

const tstz = (name: string) => timestamp(name, { withTimezone: true });
const big = (name: string) => bigint(name, { mode: "number" });

/**
 * One scheduled event's opponent, keyed by the event's `event_at_utc` (the war time): the owner sets it before
 * the event's row exists, which the tick makes a day ahead. `result` is admin-only (#286's closing comment).
 */
export const kvkOpponents = pgTable(
  "kvk_opponents",
  {
    id: serial("id").primaryKey(),
    eventAt: tstz("event_at").notNull(),
    server: integer("server").notNull(),
    tags: text("tags")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    result: text("result", { enum: ["won", "lost"] }),
    createdAt: tstz("created_at").notNull().defaultNow(),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    unique("kvk_opponents_event_at_unique").on(t.eventAt),
    check("kvk_opponents_server_check", sql`${t.server} between 1 and 9999`),
    check("kvk_opponents_tags_check", sql`cardinality(${t.tags}) <= 15`),
    check("kvk_opponents_result_check", sql`${t.result} in ('won', 'lost')`),
  ],
);

/**
 * One opponent alliance read at the Start (`before`, by tag) or the End (`after`, by the Start's union id). A
 * row is written for every call sent, so none is sent twice (INVARIANT kvk.one-call-per-row). The members are
 * uid, might and kills arrays: no names and no raw body, so no blocked roster key of another server is stored.
 */
export const kvkReads = pgTable(
  "kvk_reads",
  {
    id: serial("id").primaryKey(),
    opponentId: integer("opponent_id")
      .notNull()
      .references(() => kvkOpponents.id),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => snapshots.id),
    phase: text("phase", { enum: ["before", "after"] }).notNull(),
    tag: text("tag").notNull(),
    unionId: big("union_id"),
    sid: integer("sid"),
    name: text("name"),
    memberCount: integer("member_count"),
    totalPower: big("total_power"),
    totalKills: big("total_kills"),
    memberUids: big("member_uids").array(),
    memberPower: big("member_power").array(),
    memberKills: big("member_kills").array(),
    sourceUpdatedAt: tstz("source_updated_at"),
    cached: boolean("cached"),
    isFresh: boolean("is_fresh").notNull(),
    error: text("error"),
    readAt: tstz("read_at").notNull(),
  },
  (t) => [
    unique("kvk_reads_opponent_phase_tag_unique").on(t.opponentId, t.phase, t.tag),
    check("kvk_reads_phase_check", sql`${t.phase} in ('before', 'after')`),
  ],
);

/** One suggested alliance of the opponent's ranks board (D155): its tag, name and might only. */
export interface SuggestedAlliance {
  tag: string;
  name: string | null;
  power: number;
}

/**
 * The opponent's ranks board read for one (KvK, server) (D155): claimed before the call, so a `read` row is
 * never read again (INVARIANT suggest.one-read-per-event-server) and a failed one at most 3 times in all
 * (INVARIANT suggest.attempt-cap). /admin only.
 */
export const kvkSuggestions = pgTable(
  "kvk_suggestions",
  {
    id: serial("id").primaryKey(),
    eventAt: tstz("event_at").notNull(),
    server: integer("server").notNull(),
    status: text("status", { enum: ["running", "read", "failed"] }).notNull(),
    attempts: integer("attempts").notNull().default(1),
    alliances: jsonb("alliances").$type<SuggestedAlliance[]>(),
    /** The board's own pulled_at. */
    pulledAt: tstz("pulled_at"),
    claimedAt: tstz("claimed_at").notNull(),
    readAt: tstz("read_at"),
  },
  (t) => [
    unique("kvk_suggestions_event_at_server_unique").on(t.eventAt, t.server),
    check("kvk_suggestions_server_check", sql`${t.server} between 1 and 9999`),
    check("kvk_suggestions_status_check", sql`${t.status} in ('running', 'read', 'failed')`),
    check("kvk_suggestions_attempts_check", sql`${t.attempts} between 1 and 3`),
    check(
      "kvk_suggestions_alliances_check",
      sql`${t.alliances} is null or jsonb_array_length(${t.alliances}) <= 15`,
    ),
  ],
);
