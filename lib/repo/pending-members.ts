// pending_members (D106): the plain reads and writes behind new members added by hand before the roster
// lists them, and moving their facts (and Alliance Duel points) onto the member they turn out to be. Every
// function takes the workspace id; lib/private passes its WorkspaceAccess's own and decides who matches.
// A deleted pending member is dismissed, not removed: its row, facts and points stay (2026-11-17).
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";

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

/** Not matched and not dismissed. */
const open = (workspaceId: number) =>
  and(
    eq(pendingMembers.workspaceId, workspaceId),
    isNull(pendingMembers.matchedUid),
    isNull(pendingMembers.dismissedAt),
  );

/** Deleted by an officer and kept (2026-11-17). */
const dismissed = (workspaceId: number) =>
  and(
    eq(pendingMembers.workspaceId, workspaceId),
    isNull(pendingMembers.matchedUid),
    isNotNull(pendingMembers.dismissedAt),
  );

/** The workspace's pending members neither matched nor dismissed, oldest first. */
export async function openPendings(db: Db, workspaceId: number): Promise<PendingRow[]> {
  return db
    .select(columns)
    .from(pendingMembers)
    .where(open(workspaceId))
    .orderBy(asc(pendingMembers.createdAt), asc(pendingMembers.id));
}

/** The workspace's dismissed pending members, newest dismissal first. */
export async function dismissedPendings(
  db: Db,
  workspaceId: number,
): Promise<(PendingRow & { dismissedAt: Date })[]> {
  const rows = await db
    .select({ ...columns, dismissedAt: pendingMembers.dismissedAt })
    .from(pendingMembers)
    .where(dismissed(workspaceId))
    .orderBy(desc(pendingMembers.dismissedAt), desc(pendingMembers.id));
  return rows.map((r) => ({ ...r, dismissedAt: r.dismissedAt as Date }));
}

/**
 * Reopens the newest dismissed pending member with this key, as added again now (by this request);
 * its id, or null when none was dismissed.
 */
export async function reopenDismissed(
  db: Db,
  workspaceId: number,
  nameKey: string,
  again: { name: string; requestId: string | null; now: Date },
): Promise<number | null> {
  const [last] = await db
    .select({ id: pendingMembers.id })
    .from(pendingMembers)
    .where(and(dismissed(workspaceId), eq(pendingMembers.nameKey, nameKey)))
    .orderBy(desc(pendingMembers.dismissedAt), desc(pendingMembers.id))
    .limit(1);
  if (!last) return null;
  const [row] = await db
    .update(pendingMembers)
    .set({
      dismissedAt: null,
      name: again.name,
      createdAt: again.now,
      ...(again.requestId !== null && { requestId: again.requestId }),
    })
    .where(and(dismissed(workspaceId), eq(pendingMembers.id, last.id)))
    .returning({ id: pendingMembers.id });
  return row?.id ?? null;
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

/** Dismisses an open pending member; its row, facts and points stay. False when there is none. */
export async function dismissPending(
  db: Db,
  workspaceId: number,
  id: number,
  now: Date,
): Promise<boolean> {
  const gone = await db
    .update(pendingMembers)
    .set({ dismissedAt: now })
    .where(and(open(workspaceId), eq(pendingMembers.id, id)))
    .returning({ id: pendingMembers.id });
  return gone.length > 0;
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
