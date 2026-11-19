// thefts and theft_follow_ups (issue 321, D97): plain reads and writes, each inside one workspace. Which
// entries are kept, and what counts, is decided in lib/private.
import { and, asc, eq, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaceUsers } from "../schema";
import { theftFollowUps, thefts } from "../schema-thefts";
import { live } from "./trash";

export type TheftRow = typeof thefts.$inferSelect;
export type NewTheft = Omit<typeof thefts.$inferInsert, "id">;

/** Whether an add with this request id was already stored (D100). */
export async function theftRequested(
  db: Db,
  workspaceId: number,
  requestId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: thefts.id })
    .from(thefts)
    .where(and(eq(thefts.workspaceId, workspaceId), eq(thefts.requestId, requestId)));
  return rows.length > 0;
}

export async function insertThefts(db: Db, rows: NewTheft[]): Promise<void> {
  if (rows.length > 0) await db.insert(thefts).values(rows);
}

/**
 * One typed theft with its request id (D100). False when that id is already stored: a send that arrived
 * at the same moment won the unique index, and its row is the answer.
 */
export async function insertRequestedTheft(
  db: Db,
  row: NewTheft & { requestId: string },
): Promise<boolean> {
  const made = await db
    .insert(thefts)
    .values(row)
    .onConflictDoNothing({ target: [thefts.workspaceId, thefts.requestId] })
    .returning({ id: thefts.id });
  return made.length > 0;
}

/**
 * A deleted theft's Undo rule (D123): no live theft of the same attacker, member and time took its place
 * meanwhile (the same report imported or typed again), so Undo never makes a double.
 */
export const noTwin = sql`not exists (select 1 from thefts o
  where o.workspace_id = ${thefts.workspaceId} and o.id <> ${thefts.id} and o.deleted_at is null
    and o.attacker_key = ${thefts.attackerKey}
    and o.victim_uid is not distinct from ${thefts.victimUid}
    and o.at is not distinct from ${thefts.at})`;

/** The workspace's thefts not deleted (D123), oldest entry first. */
export function listThefts(db: Db, workspaceId: number): Promise<TheftRow[]> {
  return db
    .select()
    .from(thefts)
    .where(and(eq(thefts.workspaceId, workspaceId), live(thefts)))
    .orderBy(asc(thefts.id));
}

export async function hasAttacker(db: Db, workspaceId: number, key: string): Promise<boolean> {
  const [row] = await db
    .select({ id: thefts.id })
    .from(thefts)
    .where(and(eq(thefts.workspaceId, workspaceId), eq(thefts.attackerKey, key), live(thefts)))
    .limit(1);
  return row !== undefined;
}

/** Sets the server on every entry of one attacker, inside its own workspace; false when there is none. */
export async function setAttackerServer(
  db: Db,
  workspaceId: number,
  key: string,
  server: number | null,
): Promise<boolean> {
  const changed = await db
    .update(thefts)
    .set({ attackerServer: server })
    .where(and(eq(thefts.workspaceId, workspaceId), eq(thefts.attackerKey, key), live(thefts)))
    .returning({ id: thefts.id });
  return changed.length > 0;
}

export async function insertFollowUp(
  db: Db,
  row: Omit<typeof theftFollowUps.$inferInsert, "id">,
): Promise<void> {
  await db.insert(theftFollowUps).values(row);
}

/** One follow-up change, with the name the officer who made it shows in the desk (D87). */
export interface FollowUpRow {
  attackerKey: string;
  state: (typeof theftFollowUps.$inferSelect)["state"];
  note: string | null;
  changedAt: Date;
  by: string | null;
}

/** Every follow-up change of the workspace, oldest first. */
export async function listFollowUps(db: Db, workspaceId: number): Promise<FollowUpRow[]> {
  const rows = await db
    .select({
      attackerKey: theftFollowUps.attackerKey,
      state: theftFollowUps.state,
      note: theftFollowUps.note,
      changedAt: theftFollowUps.changedAt,
      chosenName: workspaceUsers.chosenName,
      displayName: workspaceUsers.displayName,
    })
    .from(theftFollowUps)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, theftFollowUps.changedBy))
    .where(eq(theftFollowUps.workspaceId, workspaceId))
    .orderBy(asc(theftFollowUps.id));
  return rows.map(({ chosenName, displayName, ...r }) => ({
    ...r,
    by: chosenName ?? displayName,
  }));
}
