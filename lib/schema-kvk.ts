// The KvK opponent (D152, issue 306): the server our server meets in a scheduled event, with the alliance tags
// the owner types on /admin, and the opponent's alliances read at the event's Start and End. Apart from
// lib/schema.ts for its size; drizzle.config.ts lists this file.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  integer,
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
