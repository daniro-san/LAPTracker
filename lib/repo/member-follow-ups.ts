// member_follow_ups (issue 340, D104): plain reads and writes of the officers' follow-ups, each inside one
// workspace. Which members are on the week's list, and what resolves them, is decided in lib/private.
import { and, desc, eq, gte } from "drizzle-orm";

import type { Db } from "../db";
import { workspaceUsers } from "../schema";
import { memberFollowUps } from "../schema-followup";

export type FollowUpAction = (typeof memberFollowUps.action.enumValues)[number];

/** One follow-up, with the name the officer who wrote it shows in the desk (D87). */
export interface MemberFollowUp {
  uid: number;
  action: FollowUpAction;
  note: string | null;
  until: string | null;
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

/** The members followed up since `since` (the week's start): uid and time only, for the week's list. */
export function followedUpSince(
  db: Db,
  workspaceId: number,
  since: Date,
): Promise<{ uid: number; at: Date }[]> {
  return db
    .select({ uid: memberFollowUps.uid, at: memberFollowUps.writtenAt })
    .from(memberFollowUps)
    .where(
      and(eq(memberFollowUps.workspaceId, workspaceId), gte(memberFollowUps.writtenAt, since)),
    );
}

/** One member's follow-ups, newest first, for their card. */
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
      at: memberFollowUps.writtenAt,
      chosenName: workspaceUsers.chosenName,
      displayName: workspaceUsers.displayName,
    })
    .from(memberFollowUps)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, memberFollowUps.writtenBy))
    .where(and(eq(memberFollowUps.workspaceId, workspaceId), eq(memberFollowUps.uid, uid)))
    .orderBy(desc(memberFollowUps.id));
  return rows.map(({ chosenName, displayName, ...r }) => ({ ...r, by: chosenName ?? displayName }));
}
