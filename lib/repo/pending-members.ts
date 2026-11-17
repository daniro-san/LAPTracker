// pending_members (D106): the plain reads and writes behind new members added by hand before the roster
// lists them, and moving their facts (and Alliance Duel points) onto the member they turn out to be. Every
// function takes the workspace id; lib/private passes its WorkspaceAccess's own and decides who matches.
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { Db } from "../db";
import { memberFacts, pendingMembers } from "../schema";
import { allianceDuelPoints } from "../schema-import";

export interface PendingRow {
  id: number;
  name: string;
  nameKey: string;
  createdAt: Date;
}

const columns = {
  id: pendingMembers.id,
  name: pendingMembers.name,
  nameKey: pendingMembers.nameKey,
  createdAt: pendingMembers.createdAt,
};

const open = (workspaceId: number) =>
  and(eq(pendingMembers.workspaceId, workspaceId), isNull(pendingMembers.matchedUid));

/** The workspace's pending members not matched yet, oldest first. */
export async function openPendings(db: Db, workspaceId: number): Promise<PendingRow[]> {
  return db
    .select(columns)
    .from(pendingMembers)
    .where(open(workspaceId))
    .orderBy(asc(pendingMembers.createdAt), asc(pendingMembers.id));
}

/** The pending member an add with this request id made (matched or not), or the open one with this key. */
export async function findPending(
  db: Db,
  workspaceId: number,
  by: { requestId: string } | { nameKey: string } | { id: number },
): Promise<PendingRow | null> {
  const where =
    "requestId" in by
      ? and(eq(pendingMembers.workspaceId, workspaceId), eq(pendingMembers.requestId, by.requestId))
      : and(
          open(workspaceId),
          "id" in by ? eq(pendingMembers.id, by.id) : eq(pendingMembers.nameKey, by.nameKey),
        );
  const [row] = await db.select(columns).from(pendingMembers).where(where).limit(1);
  return row ?? null;
}

/** A new pending member; null when an open one has that key, or an add with that request id exists. */
export async function insertPending(
  db: Db,
  row: typeof pendingMembers.$inferInsert,
): Promise<number | null> {
  const [added] = await db
    .insert(pendingMembers)
    .values(row)
    .onConflictDoNothing()
    .returning({ id: pendingMembers.id });
  return added?.id ?? null;
}

/** Marks an open pending member as `uid`; its row, or null when another request matched it first. */
export async function claimPending(
  db: Db,
  workspaceId: number,
  id: number,
  uid: number,
  now: Date,
): Promise<PendingRow | null> {
  const [row] = await db
    .update(pendingMembers)
    .set({ matchedUid: uid, matchedAt: now })
    .where(and(open(workspaceId), eq(pendingMembers.id, id)))
    .returning(columns);
  return row ?? null;
}

/**
 * Moves every fact version of `from` to `to`. A field `to` already has keeps its versions, and `from`'s
 * follow them (version + the newest of `to`), with their values, sources, writers and times. The
 * subquery sees the table as the statement found it, so moved rows never count toward the offset.
 */
export async function moveFacts(db: Db, workspaceId: number, from: number, to: number) {
  await db.execute(sql`
    update member_facts p
    set uid = ${to},
        version = p.version + coalesce((
          select max(r.version) from member_facts r
          where r.workspace_id = ${workspaceId} and r.uid = ${to} and r.field = p.field), 0)
    where p.workspace_id = ${workspaceId} and p.uid = ${from}`);
}

/** Moves Alliance Duel points of `from` to `to`; a day `to` already has keeps `to`'s value. */
export async function moveDuelPoints(db: Db, workspaceId: number, from: number, to: number) {
  await db.execute(sql`
    update alliance_duel_points p set uid = ${to}
    where p.workspace_id = ${workspaceId} and p.uid = ${from} and not exists (
      select 1 from alliance_duel_points r
      where r.workspace_id = p.workspace_id and r.uid = ${to} and r.week = p.week and r.day = p.day)`);
  await db
    .delete(allianceDuelPoints)
    .where(and(eq(allianceDuelPoints.workspaceId, workspaceId), eq(allianceDuelPoints.uid, from)));
}

/** Deletes an open pending member with its facts and points (uid `-id`); false when there is none. */
export async function deletePending(db: Db, workspaceId: number, id: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const gone = await tx
      .delete(pendingMembers)
      .where(and(open(workspaceId), eq(pendingMembers.id, id)))
      .returning({ id: pendingMembers.id });
    if (gone.length === 0) return false;
    const of = (t: typeof memberFacts | typeof allianceDuelPoints) =>
      and(eq(t.workspaceId, workspaceId), eq(t.uid, -id));
    await tx.delete(memberFacts).where(of(memberFacts));
    await tx.delete(allianceDuelPoints).where(of(allianceDuelPoints));
    return true;
  });
}

/** Which of `uids` have any fact version in the workspace (a facts history). */
export async function uidsWithFacts(
  db: Db,
  workspaceId: number,
  uids: readonly number[],
): Promise<Set<number>> {
  if (uids.length === 0) return new Set();
  const rows = await db
    .selectDistinct({ uid: memberFacts.uid })
    .from(memberFacts)
    .where(and(eq(memberFacts.workspaceId, workspaceId), inArray(memberFacts.uid, [...uids])));
  return new Set(rows.map((r) => r.uid));
}
