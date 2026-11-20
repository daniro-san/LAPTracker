// roll_calls, roll_call_marks and roll_call_team (issue 298, D103): plain reads and writes, each inside one
// workspace. Which marks a roll call takes, the version check and the words stay in lib/private. Every read
// here leaves out a deleted roll call (`live`, D120).
import { and, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import { rollCallMarks, rollCalls, rollCallTeam, workspaceUsers } from "../schema";

export type RollCallRow = typeof rollCalls.$inferSelect;
/** Not deleted (D120): a deleted roll call leaves every list, count and Home. */
export const live = isNull(rollCalls.deletedAt);
/**
 * Its Calendar entry is there and not deleted (D123). A deleted entry keeps its id on the roll call (a soft
 * delete, not the old cascade), so `entry_id is null` no longer says the entry is gone.
 */
const entryLive = sql`exists (select 1 from calendar_entries c
  where c.id = ${rollCalls.entryId} and c.deleted_at is null)`;
/** A connection or a transaction. */
type Tx = Pick<Db, "select" | "insert" | "delete" | "execute">;

export interface MarkRow {
  rollCallId: number;
  uid: number;
  version: number;
  mark: string | null;
  /** The officer's chosen name, else their Discord name; null when unknown. */
  by: string | null;
  at: Date;
}

const markColumns = {
  rollCallId: rollCallMarks.rollCallId,
  uid: rollCallMarks.uid,
  version: rollCallMarks.version,
  mark: rollCallMarks.mark,
  by: sql<string | null>`coalesce(${workspaceUsers.chosenName}, ${workspaceUsers.displayName})`,
  at: rollCallMarks.writtenAt,
};

export async function findCall(
  db: Db,
  workspaceId: number,
  where: { id: number } | { entryId: number; week: string } | { requestId: string },
): Promise<RollCallRow | null> {
  const match =
    "id" in where
      ? eq(rollCalls.id, where.id)
      : "requestId" in where
        ? eq(rollCalls.requestId, where.requestId)
        : and(eq(rollCalls.entryId, where.entryId), eq(rollCalls.week, where.week));
  const [row] = await db
    .select()
    .from(rollCalls)
    .where(and(eq(rollCalls.workspaceId, workspaceId), match, live))
    .limit(1);
  return row ?? null;
}

/** A roll call added by hand for this kind and day (no live Calendar entry), so a second add opens it. */
export async function findAdded(
  db: Db,
  workspaceId: number,
  kind: string,
  day: string,
): Promise<RollCallRow | null> {
  const [row] = await db
    .select()
    .from(rollCalls)
    .where(
      and(
        eq(rollCalls.workspaceId, workspaceId),
        eq(rollCalls.kind, kind),
        eq(rollCalls.day, day),
        sql`not ${entryLive}`,
        live,
      ),
    )
    .orderBy(rollCalls.id)
    .limit(1);
  return row ?? null;
}

/** A new roll call's id; null when another one with its entry and week, or its request id, won. */
export async function insertCall(
  db: Db,
  values: typeof rollCalls.$inferInsert,
): Promise<number | null> {
  const [row] = await db
    .insert(rollCalls)
    .values(values)
    .onConflictDoNothing()
    .returning({ id: rollCalls.id });
  return row?.id ?? null;
}

/** Every roll call of the weeks that start on these Mondays, archived ones included. */
export async function callsOfWeeks(db: Db, workspaceId: number, weeks: string[]) {
  return db
    .select()
    .from(rollCalls)
    .where(and(eq(rollCalls.workspaceId, workspaceId), inArray(rollCalls.week, weeks), live))
    .orderBy(rollCalls.day, rollCalls.id);
}

/** The week's Elixir Scramble teams: its roll calls whose Calendar entry is live (D123). */
export async function teamCalls(db: Db, workspaceId: number, week: string) {
  return db
    .select()
    .from(rollCalls)
    .where(
      and(
        eq(rollCalls.workspaceId, workspaceId),
        eq(rollCalls.kind, "elixir"),
        eq(rollCalls.week, week),
        live,
        entryLive,
      ),
    );
}

/** How many roll calls on these days (`from` to `to`) are archived (D120). */
export async function archivedCount(db: Db, workspaceId: number, from: string, to: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(rollCalls)
    .where(
      and(
        eq(rollCalls.workspaceId, workspaceId),
        isNotNull(rollCalls.archivedAt),
        live,
        gte(rollCalls.day, from),
        lte(rollCalls.day, to),
      ),
    );
  return row?.n ?? 0;
}

/** The archived roll calls (D120), the newest day first. */
export async function archivedCalls(db: Db, workspaceId: number) {
  return db
    .select()
    .from(rollCalls)
    .where(and(eq(rollCalls.workspaceId, workspaceId), isNotNull(rollCalls.archivedAt), live))
    .orderBy(desc(rollCalls.day), desc(rollCalls.id));
}

/** Which mark of a member: the roll call's own (`main`), or Raid prep's squads off the wall (D137). */
export type MarkPart = "main" | "wall";

/** The newest mark of each member in each of these roll calls, of one part (the roll call's own by default). */
export async function newestMarks(
  db: Db,
  callIds: number[],
  part: MarkPart = "main",
): Promise<MarkRow[]> {
  if (callIds.length === 0) return [];
  return db
    .selectDistinctOn([rollCallMarks.rollCallId, rollCallMarks.uid], markColumns)
    .from(rollCallMarks)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, rollCallMarks.writtenBy))
    .where(and(inArray(rollCallMarks.rollCallId, callIds), eq(rollCallMarks.part, part)))
    .orderBy(rollCallMarks.rollCallId, rollCallMarks.uid, desc(rollCallMarks.version));
}

/** One member's newest mark of one part in a roll call, or null before the first. */
export async function newestMark(
  db: Db,
  callId: number,
  uid: number,
  part: MarkPart = "main",
): Promise<MarkRow | null> {
  const [row] = await db
    .select(markColumns)
    .from(rollCallMarks)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, rollCallMarks.writtenBy))
    .where(
      and(
        eq(rollCallMarks.rollCallId, callId),
        eq(rollCallMarks.uid, uid),
        eq(rollCallMarks.part, part),
      ),
    )
    .orderBy(desc(rollCallMarks.version))
    .limit(1);
  return row ?? null;
}

/** Appends marks; returns the ones stored. A version already taken (another write won) is skipped. */
export async function insertMarks(
  db: Db,
  rows: (typeof rollCallMarks.$inferInsert)[],
): Promise<{ uid: number; version: number }[]> {
  if (rows.length === 0) return [];
  return db
    .insert(rollCallMarks)
    .values(rows)
    .onConflictDoNothing()
    .returning({ uid: rollCallMarks.uid, version: rollCallMarks.version });
}

/** The members of these Elixir Scramble teams. */
export async function teamsOf(db: Pick<Db, "select">, callIds: number[]) {
  if (callIds.length === 0) return [];
  return db
    .select({ rollCallId: rollCallTeam.rollCallId, uid: rollCallTeam.uid, name: rollCallTeam.name })
    .from(rollCallTeam)
    .where(inArray(rollCallTeam.rollCallId, callIds))
    .orderBy(rollCallTeam.addedAt, rollCallTeam.uid);
}

/**
 * Locks a workspace's Elixir Scramble week for the rest of the transaction (an advisory lock on a hash of
 * the workspace and the week), so changes to its two teams run one at a time and a member cannot land on
 * both.
 */
export async function lockWeek(tx: Tx, workspaceId: number, week: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`roll-call-team:${workspaceId}:${week}`}))`,
  );
}

/** Whether `uid` is on this Elixir Scramble team. */
export async function teamHas(db: Db, callId: number, uid: number): Promise<boolean> {
  const [row] = await db
    .select({ uid: rollCallTeam.uid })
    .from(rollCallTeam)
    .where(and(eq(rollCallTeam.rollCallId, callId), eq(rollCallTeam.uid, uid)))
    .limit(1);
  return row !== undefined;
}

/**
 * The members on the other Elixir Scramble teams of the same workspace and week, with their team. A roll
 * call whose Calendar entry was deleted is not a team any more and is left out.
 */
export async function otherTeams(tx: Tx, call: RollCallRow) {
  return tx
    .select({ uid: rollCallTeam.uid, variant: rollCalls.variant })
    .from(rollCallTeam)
    .innerJoin(rollCalls, eq(rollCalls.id, rollCallTeam.rollCallId))
    .where(
      and(
        eq(rollCalls.workspaceId, call.workspaceId),
        eq(rollCalls.kind, "elixir"),
        eq(rollCalls.week, call.week),
        ne(rollCalls.id, call.id),
        entryLive,
        live,
      ),
    );
}

export async function addToTeam(tx: Tx, rows: (typeof rollCallTeam.$inferInsert)[]) {
  if (rows.length > 0) await tx.insert(rollCallTeam).values(rows).onConflictDoNothing();
}

export async function removeFromTeam(tx: Tx, callId: number, uids: number[]) {
  await tx
    .delete(rollCallTeam)
    .where(and(eq(rollCallTeam.rollCallId, callId), inArray(rollCallTeam.uid, uids)));
}
