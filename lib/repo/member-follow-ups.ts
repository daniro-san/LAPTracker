// member_follow_ups (issue 340, D104): plain reads and writes of the officers' follow-ups, each inside one
// workspace. Which members are on the week's list, and what resolves them, is decided in lib/private.
import { and, asc, eq, gte, inArray } from "drizzle-orm";

import type { Db } from "../db";
import { memberFacts, workspaceUsers } from "../schema";
import { memberFollowUps } from "../schema-followup";

export type FollowUpAction = (typeof memberFollowUps.action.enumValues)[number];

/** One follow-up, with the name the officer who wrote it shows in the desk (D87). */
export interface MemberFollowUp {
  uid: number;
  action: FollowUpAction;
  note: string | null;
  until: string | null;
  factVersion: number | null;
  requestId: string;
  at: Date;
  by: string | null;
}

/** Whether a follow-up with this request id was already stored (D100). */
export async function followUpRequested(
  db: Db,
  workspaceId: number,
  requestId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: memberFollowUps.id })
    .from(memberFollowUps)
    .where(
      and(eq(memberFollowUps.workspaceId, workspaceId), eq(memberFollowUps.requestId, requestId)),
    );
  return rows.length > 0;
}

/** Appends one follow-up; a second send with the same request id stores nothing. */
export async function insertMemberFollowUp(
  db: Db,
  row: Omit<typeof memberFollowUps.$inferInsert, "id">,
): Promise<void> {
  await db
    .insert(memberFollowUps)
    .values(row)
    .onConflictDoNothing({ target: [memberFollowUps.workspaceId, memberFollowUps.requestId] });
}

/**
 * The records since `since` (the week's start), oldest first: uid, action and time only, for the week's
 * list and its counts (a "withdrawn" cancels the record before it).
 */
export function followedUpSince(
  db: Db,
  workspaceId: number,
  since: Date,
): Promise<{ uid: number; action: FollowUpAction; at: Date }[]> {
  return db
    .select({
      uid: memberFollowUps.uid,
      action: memberFollowUps.action,
      at: memberFollowUps.writtenAt,
    })
    .from(memberFollowUps)
    .where(and(eq(memberFollowUps.workspaceId, workspaceId), gte(memberFollowUps.writtenAt, since)))
    .orderBy(asc(memberFollowUps.id));
}

/** One record of the week as Follow-up's "Noted this week" shows it. */
export type WeekRecord = Omit<MemberFollowUp, "factVersion" | "requestId">;

/**
 * The same records with the note, the last day away and the officer's desk name, for Follow-up's "Noted
 * this week" only (#585); Home and Members count with `followedUpSince`.
 */
export async function notedSince(db: Db, workspaceId: number, since: Date): Promise<WeekRecord[]> {
  const rows = await db
    .select({
      uid: memberFollowUps.uid,
      action: memberFollowUps.action,
      note: memberFollowUps.note,
      until: memberFollowUps.until,
      at: memberFollowUps.writtenAt,
      chosenName: workspaceUsers.chosenName,
      displayName: workspaceUsers.displayName,
    })
    .from(memberFollowUps)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, memberFollowUps.writtenBy))
    .where(and(eq(memberFollowUps.workspaceId, workspaceId), gte(memberFollowUps.writtenAt, since)))
    .orderBy(asc(memberFollowUps.id));
  return rows.map(({ chosenName, displayName, ...r }) => ({ ...r, by: chosenName ?? displayName }));
}

/** One member's follow-ups, oldest first, for their card and for Undo. */
export async function listMemberFollowUps(
  db: Db,
  workspaceId: number,
  uid: number,
): Promise<MemberFollowUp[]> {
  const rows = await db
    .select({
      uid: memberFollowUps.uid,
      action: memberFollowUps.action,
      note: memberFollowUps.note,
      until: memberFollowUps.until,
      factVersion: memberFollowUps.factVersion,
      requestId: memberFollowUps.requestId,
      at: memberFollowUps.writtenAt,
      chosenName: workspaceUsers.chosenName,
      displayName: workspaceUsers.displayName,
    })
    .from(memberFollowUps)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, memberFollowUps.writtenBy))
    .where(and(eq(memberFollowUps.workspaceId, workspaceId), eq(memberFollowUps.uid, uid)))
    .orderBy(asc(memberFollowUps.id));
  return rows.map(({ chosenName, displayName, ...r }) => ({ ...r, by: chosenName ?? displayName }));
}

/**
 * What a Needs help mark is read from (#585 S2), for `uids` of one workspace: each member's `status`
 * versions (oldest first, with the writer's desk name) and Follow-up records (oldest first). Both selects
 * are filtered by `workspace_id`; only the few members marked Needs help are asked for.
 */
export async function helpMarkRows(db: Db, workspaceId: number, uids: readonly number[]) {
  if (uids.length === 0) return { versions: [], records: [] };
  const [versions, records] = await Promise.all([
    db
      .select({
        uid: memberFacts.uid,
        version: memberFacts.version,
        value: memberFacts.value,
        at: memberFacts.writtenAt,
        chosenName: workspaceUsers.chosenName,
        displayName: workspaceUsers.displayName,
      })
      .from(memberFacts)
      .leftJoin(workspaceUsers, eq(workspaceUsers.id, memberFacts.writtenBy))
      .where(
        and(
          eq(memberFacts.workspaceId, workspaceId),
          eq(memberFacts.field, "status"),
          inArray(memberFacts.uid, [...uids]),
        ),
      )
      .orderBy(asc(memberFacts.version)),
    db
      .select({
        uid: memberFollowUps.uid,
        action: memberFollowUps.action,
        note: memberFollowUps.note,
        factVersion: memberFollowUps.factVersion,
        at: memberFollowUps.writtenAt,
        chosenName: workspaceUsers.chosenName,
        displayName: workspaceUsers.displayName,
      })
      .from(memberFollowUps)
      .leftJoin(workspaceUsers, eq(workspaceUsers.id, memberFollowUps.writtenBy))
      .where(
        and(eq(memberFollowUps.workspaceId, workspaceId), inArray(memberFollowUps.uid, [...uids])),
      )
      .orderBy(asc(memberFollowUps.id)),
  ]);
  const named = <T extends { chosenName: string | null; displayName: string | null }>(rows: T[]) =>
    rows.map(({ chosenName, displayName, ...r }) => ({ ...r, by: chosenName ?? displayName }));
  return { versions: named(versions), records: named(records) };
}

/** The desk name of the officer who wrote one version of a member's fact; null when not known. */
export async function factWriter(
  db: Db,
  workspaceId: number,
  uid: number,
  field: string,
  version: number,
): Promise<string | null> {
  const [row] = await db
    .select({ chosen: workspaceUsers.chosenName, display: workspaceUsers.displayName })
    .from(memberFacts)
    .innerJoin(workspaceUsers, eq(workspaceUsers.id, memberFacts.writtenBy))
    .where(
      and(
        eq(memberFacts.workspaceId, workspaceId),
        eq(memberFacts.uid, uid),
        eq(memberFacts.field, field),
        eq(memberFacts.version, version),
      ),
    );
  return row ? (row.chosen ?? row.display) : null;
}
