// thefts and theft_follow_ups (issue 321, D97): plain reads and writes, each inside one workspace. Which
// entries are kept, and what counts, is decided in lib/private.
import { and, asc, desc, eq, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaceUsers } from "../schema";
import { theftAttackers, theftFollowUps, thefts } from "../schema-thefts";
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

/**
 * An attacker's server as an officer set it, kept per attacker (not on the entries, so a delete and its
 * Undo cannot change it). `server` null: the officer said "not known".
 */
export async function setAttackerServer(
  db: Db,
  row: {
    workspaceId: number;
    attackerKey: string;
    server: number | null;
    setBy: number;
    setAt: Date;
  },
): Promise<void> {
  const { server, setBy, setAt } = row;
  await db
    .insert(theftAttackers)
    .values(row)
    .onConflictDoUpdate({
      target: [theftAttackers.workspaceId, theftAttackers.attackerKey],
      set: { server, setBy, setAt },
    });
}

/** The servers officers set, by attacker key (null: "not known"). An attacker with no row is not here. */
export async function attackerServers(
  db: Db,
  workspaceId: number,
): Promise<Map<string, number | null>> {
  const rows = await db
    .select({ key: theftAttackers.attackerKey, server: theftAttackers.server })
    .from(theftAttackers)
    .where(eq(theftAttackers.workspaceId, workspaceId));
  return new Map(rows.map((r) => [r.key, r.server]));
}

/** Whether a step with this request id was already stored (D100). */
export async function followUpRequested(
  db: Db,
  workspaceId: number,
  requestId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: theftFollowUps.id })
    .from(theftFollowUps)
    .where(
      and(eq(theftFollowUps.workspaceId, workspaceId), eq(theftFollowUps.requestId, requestId)),
    );
  return rows.length > 0;
}

/** The id of an attacker's newest step; null when none was set. */
export async function latestFollowUpId(
  db: Db,
  workspaceId: number,
  key: string,
): Promise<number | null> {
  const [row] = await db
    .select({ id: theftFollowUps.id })
    .from(theftFollowUps)
    .where(and(eq(theftFollowUps.workspaceId, workspaceId), eq(theftFollowUps.attackerKey, key)))
    .orderBy(desc(theftFollowUps.id))
    .limit(1);
  return row?.id ?? null;
}

/** One step with its request id; a send that arrived at the same moment wins the unique index. */
export async function insertFollowUp(
  db: Db,
  row: Omit<typeof theftFollowUps.$inferInsert, "id">,
): Promise<void> {
  await db
    .insert(theftFollowUps)
    .values(row)
    .onConflictDoNothing({ target: [theftFollowUps.workspaceId, theftFollowUps.requestId] });
}

/** One follow-up change, with the name the officer who made it shows in the desk (D87). */
export interface FollowUpRow {
  id: number;
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
      id: theftFollowUps.id,
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
