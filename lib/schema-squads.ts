// The squads from the tracker (D117, issue 413), apart from lib/schema.ts for its size; drizzle.config.ts
// lists this file too. Squads are workspace-only data of the own alliance (D71): read by lib/private for
// that workspace's card, written by the nightly squads read.
import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
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
    /** The tracker's `seen_at`; null when it sent none. */
    seenAt: tstz("seen_at"),
    /** Our read that stored this row. */
    readAt: tstz("read_at").notNull(),
  },
  (t) => [index("member_squads_member_idx").on(t.unionId, t.uid, t.squad)],
);

/**
 * The squads read of one server day (D117): batches across calls, the last uid done, what it cost and
 * why it stopped. Counts and codes only: no names, no squad values.
 */
export const squadReads = pgTable(
  "squad_reads",
  {
    day: date("day", { mode: "string" })
      .primaryKey()
      .references(() => dailyReads.day),
    unionId: big("union_id").notNull(),
    status: text("status", { enum: ["running", "done", "stopped", "skipped"] }).notNull(),
    startedAt: tstz("started_at").notNull(),
    /** When the batch running now (or the last one) took the day; a batch older than 150 s was killed. */
    batchAt: tstz("batch_at"),
    finishedAt: tstz("finished_at"),
    /** Members in the day's roster: the run's cap. */
    members: integer("members").notNull(),
    /** The uid read last; the next batch goes on from the next higher uid. */
    afterUid: big("after_uid"),
    callsUsed: integer("calls_used").notNull().default(0),
    withSquads: integer("with_squads").notNull().default(0),
    failed: integer("failed").notNull().default(0),
    /** The quota left after the newest call (or the estimate the run started from). */
    quotaRemaining: integer("quota_remaining"),
    /** Why it was skipped or stopped: a code. */
    reason: text("reason"),
  },
  (t) => [
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
