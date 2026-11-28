// member_self_reports (D154, issue 301): the plain reads and writes behind what a member sent about
// themselves from their own page. Every function takes the workspace id; lib/private passes its door's own
// (BoardAccess for the member's writes, WorkspaceAccess for the officers'). The reads for officers show only
// the reports of the user who holds the approved link to the player now, and is not blocked, so a removed
// link or an impostor's reports never reach a card. Which fields, the limit and the answers stay in
// lib/private.
import { and, eq, lt, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import { memberSelfReports, workspaceUsers } from "../schema";
import { DAY_KEY_PREFIX } from "./auth-attempts";

export type ReportField = "adTech" | "timeZone" | "languages";
/** The member's away days (issue 829): `{from, until}` or null; kept out of the three fields' reads below. */
export const AWAY = "away";

export interface ReportRow {
  userId: number;
  uid: number;
  field: ReportField;
  value: unknown;
  version: number;
  writtenAt: Date;
  seenVersion: number;
}

/** The member's daily send counter in auth_attempts (D154): a day key, so it is kept 24 hours. */
export const selfReportLimitKey = (userId: number) => `${DAY_KEY_PREFIX}selfreport:${userId}`;

const r = memberSelfReports;
const notAway = ne(r.field, AWAY);
const columns = {
  userId: r.userId,
  uid: r.uid,
  field: r.field,
  value: r.value,
  version: r.version,
  writtenAt: r.writtenAt,
  seenVersion: r.seenVersion,
};

/** The user who holds the approved link to the report's player now, and is not blocked. */
const heldNow = and(
  eq(workspaceUsers.id, r.userId),
  eq(workspaceUsers.playerUid, r.uid),
  eq(workspaceUsers.playerLink, "approved"),
  eq(workspaceUsers.blocked, false),
);

/** One member's own reports, whatever player they were sent for: at most one per field. */
export async function ownReports(
  db: Db,
  workspaceId: number,
  userId: number,
): Promise<ReportRow[]> {
  return db
    .select(columns)
    .from(r)
    .where(and(eq(r.workspaceId, workspaceId), eq(r.userId, userId), notAway)) as Promise<
    ReportRow[]
  >;
}

/** The member's own away row for `uid`, whatever its state: the version a next write names. */
export async function ownAway(db: Db, workspaceId: number, userId: number) {
  const [row] = await db
    .select({ uid: r.uid, value: r.value, version: r.version })
    .from(r)
    .where(and(eq(r.workspaceId, workspaceId), eq(r.userId, userId), eq(r.field, AWAY)));
  return row ?? null;
}

/** Every away report that stands now: from the user who holds the approved link to its player. */
export async function awayReports(db: Db, workspaceId: number) {
  return db
    .select({ uid: r.uid, value: r.value, writtenAt: r.writtenAt })
    .from(r)
    .innerJoin(workspaceUsers, heldNow)
    .where(and(eq(r.workspaceId, workspaceId), eq(r.field, AWAY)));
}

/** Whether any field of this user was stored under this request id (D100). */
export async function sentAlready(
  db: Db,
  workspaceId: number,
  userId: number,
  requestId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: r.id })
    .from(r)
    .where(and(eq(r.workspaceId, workspaceId), eq(r.userId, userId), eq(r.requestId, requestId)))
    .limit(1);
  return row !== undefined;
}

/**
 * Stores one field as the version after `basis` (0: the first send). False when the stored version is not
 * `basis`: another tab or phone sent it since. One statement, so two sends of the same version cannot both
 * win.
 */
export async function writeReport(
  db: Db,
  row: {
    workspaceId: number;
    userId: number;
    uid: number;
    field: ReportField | typeof AWAY;
    value: unknown;
    requestId: string;
    writtenAt: Date;
  },
  basis: number,
): Promise<boolean> {
  if (basis === 0) {
    const added = await db
      .insert(r)
      .values({ ...row, version: 1 })
      .onConflictDoNothing()
      .returning({ id: r.id });
    return added.length > 0;
  }
  const changed = await db
    .update(r)
    .set({
      uid: row.uid,
      value: row.value === null ? sql`null` : row.value,
      version: basis + 1,
      requestId: row.requestId,
      writtenAt: row.writtenAt,
    })
    .where(
      and(
        eq(r.workspaceId, row.workspaceId),
        eq(r.userId, row.userId),
        eq(r.field, row.field),
        eq(r.version, basis),
      ),
    )
    .returning({ id: r.id });
  return changed.length > 0;
}

/** A player's reports from the user who holds the approved link to them now. */
export async function reportsOfPlayer(
  db: Db,
  workspaceId: number,
  uid: number,
): Promise<ReportRow[]> {
  return db
    .select(columns)
    .from(r)
    .innerJoin(workspaceUsers, heldNow)
    .where(and(eq(r.workspaceId, workspaceId), eq(r.uid, uid), notAway)) as Promise<ReportRow[]>;
}

/** The reports no officer has seen yet, from users who hold the approved link to their player now. */
export async function unseenReports(db: Db, workspaceId: number): Promise<ReportRow[]> {
  return db
    .select(columns)
    .from(r)
    .innerJoin(workspaceUsers, heldNow)
    .where(and(eq(r.workspaceId, workspaceId), lt(r.seenVersion, r.version), notAway))
    .orderBy(r.writtenAt) as Promise<ReportRow[]>;
}

/**
 * Marks one report seen as the officer saw it: that user, that player, that version, while the user still
 * holds the approved link. False when any of it changed since.
 */
export async function markSeen(
  db: Db,
  workspaceId: number,
  report: { userId: number; uid: number; field: ReportField; version: number },
  by: number,
  at: Date,
): Promise<boolean> {
  const held = db
    .select({ id: workspaceUsers.id })
    .from(workspaceUsers)
    .where(
      and(
        eq(workspaceUsers.id, report.userId),
        eq(workspaceUsers.workspaceId, workspaceId),
        eq(workspaceUsers.playerUid, report.uid),
        eq(workspaceUsers.playerLink, "approved"),
        eq(workspaceUsers.blocked, false),
      ),
    );
  const changed = await db
    .update(r)
    .set({ seenVersion: report.version, seenBy: by, seenAt: at })
    .where(
      and(
        eq(r.workspaceId, workspaceId),
        eq(r.userId, report.userId),
        eq(r.uid, report.uid),
        eq(r.field, report.field),
        eq(r.version, report.version),
        sql`exists (${held})`,
      ),
    )
    .returning({ id: r.id });
  return changed.length > 0;
}
