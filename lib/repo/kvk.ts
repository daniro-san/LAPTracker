// The KvK opponent's tables (D152): the collector's view (which opponent a run reads, its rows so far, a row's
// insert) and /admin's (save the server and tags, the result, the card's list).
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";

import { RUN_STALE_AFTER_MS } from "../compute";
import type { Db } from "../db";
import { events, snapshots } from "../schema";
import { kvkOpponents, kvkReads } from "../schema-kvk";
import type { Phase } from "./index";

/** A scheduled event's opponent as a run reads it. */
export interface OpponentInfo {
  id: number;
  server: number;
  tags: string[];
  /** The war time: no Start call at or after it (INVARIANT kvk.start-before-war). */
  eventAtUtc: Date;
}

/** One kvk_reads row. Data fields are null on an error row. */
export interface OpponentRead {
  opponentId: number;
  snapshotId: number;
  phase: Phase;
  tag: string;
  unionId: number | null;
  sid: number | null;
  name: string | null;
  memberCount: number | null;
  totalPower: number | null;
  totalKills: number | null;
  memberUids: number[] | null;
  memberPower: (number | null)[] | null;
  memberKills: (number | null)[] | null;
  sourceUpdatedAt: Date | null;
  cached: boolean | null;
  isFresh: boolean;
  error: string | null;
  readAt: Date;
}

/**
 * The opponent of the run's event: only a scheduled event (not a rehearsal, not a manual round) whose war time
 * is the opponent's `event_at` (D152).
 */
export async function opponentFor(db: Db, eventId: number): Promise<OpponentInfo | null> {
  const [row] = await db
    .select({
      id: kvkOpponents.id,
      server: kvkOpponents.server,
      tags: kvkOpponents.tags,
      eventAtUtc: events.eventAtUtc,
    })
    .from(events)
    .innerJoin(kvkOpponents, eq(kvkOpponents.eventAt, events.eventAtUtc))
    .where(and(eq(events.id, eventId), eq(events.isTest, false), eq(events.manual, false)));
  return row ?? null;
}

const readColumns = {
  opponentId: kvkReads.opponentId,
  snapshotId: kvkReads.snapshotId,
  phase: kvkReads.phase,
  tag: kvkReads.tag,
  unionId: kvkReads.unionId,
  sid: kvkReads.sid,
  name: kvkReads.name,
  memberCount: kvkReads.memberCount,
  totalPower: kvkReads.totalPower,
  totalKills: kvkReads.totalKills,
  memberUids: kvkReads.memberUids,
  memberPower: kvkReads.memberPower,
  memberKills: kvkReads.memberKills,
  sourceUpdatedAt: kvkReads.sourceUpdatedAt,
  cached: kvkReads.cached,
  isFresh: kvkReads.isFresh,
  error: kvkReads.error,
  readAt: kvkReads.readAt,
};

/** Every row of the opponents, in insert order. */
export async function opponentReads(db: Db, opponentIds: number[]): Promise<OpponentRead[]> {
  if (opponentIds.length === 0) return [];
  return db
    .select(readColumns)
    .from(kvkReads)
    .where(inArray(kvkReads.opponentId, opponentIds))
    .orderBy(asc(kvkReads.id));
}

/** One row per call sent (INVARIANT kvk.one-call-per-row); a second row for the same tag and phase is dropped. */
export async function insertOpponentRead(db: Db, row: OpponentRead): Promise<void> {
  // Drizzle types the elements as numbers; a null stays null in the array (D15).
  const arrays = {
    memberPower: row.memberPower as number[] | null,
    memberKills: row.memberKills as number[] | null,
  };
  await db
    .insert(kvkReads)
    .values({ ...row, ...arrays })
    .onConflictDoNothing();
}

export type SaveRefusal = "war_started" | "opponent_read" | "snapshot_running";

/**
 * The owner's server and tags for the event at `eventAt`. Refused at or after the war time, while the event's
 * Before or After runs, and for a new server once its Start read any tag; the last is one conditional
 * statement, so a Start that writes its first row in between cannot be missed.
 */
export async function saveOpponent(
  db: Db,
  input: { eventAt: Date; server: number; tags: string[] },
  now: Date,
): Promise<SaveRefusal | null> {
  if (now >= input.eventAt) return "war_started";
  const running = await db
    .select({ id: snapshots.id })
    .from(snapshots)
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(
      and(
        eq(events.eventAtUtc, input.eventAt),
        eq(snapshots.status, "running"),
        // A run left running past this is not running any more (D43).
        gt(snapshots.startedAt, new Date(now.getTime() - RUN_STALE_AFTER_MS)),
      ),
    );
  if (running.length > 0) return "snapshot_running";
  const saved = await db
    .insert(kvkOpponents)
    .values({ ...input, updatedAt: now })
    .onConflictDoUpdate({
      target: kvkOpponents.eventAt,
      set: { server: input.server, tags: input.tags, updatedAt: now },
      setWhere: sql`${kvkOpponents.server} = ${input.server} or not exists (select 1 from ${kvkReads} where ${kvkReads.opponentId} = ${kvkOpponents.id})`,
    })
    .returning({ id: kvkOpponents.id });
  return saved.length > 0 ? null : "opponent_read";
}

/** The owner's result for the event at `eventAt`; false when that event has no opponent saved. */
export async function setOpponentResult(
  db: Db,
  eventAt: Date,
  result: "won" | "lost" | null,
  now: Date,
): Promise<boolean> {
  const rows = await db
    .update(kvkOpponents)
    .set({ result, updatedAt: now })
    .where(eq(kvkOpponents.eventAt, eventAt))
    .returning({ id: kvkOpponents.id });
  return rows.length > 0;
}

/** The opponents of these war times, for /admin's card. */
export async function opponentsAt(db: Db, eventAts: Date[]) {
  if (eventAts.length === 0) return [];
  return db
    .select({
      id: kvkOpponents.id,
      eventAt: kvkOpponents.eventAt,
      server: kvkOpponents.server,
      tags: kvkOpponents.tags,
      result: kvkOpponents.result,
    })
    .from(kvkOpponents)
    .where(inArray(kvkOpponents.eventAt, eventAts));
}
