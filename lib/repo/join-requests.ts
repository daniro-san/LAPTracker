// join_requests (issue 868): the `/join` requests of a workspace's Discord server. Plain reads and writes; every
// function takes the workspace id, and lib/private passes its access's own. A request is open while it is
// younger than `since` (JOIN_REQUEST_DAYS): an older one is neither listed nor answered, and the tick purges it.
import { and, asc, eq, gt, lte, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaceUsers } from "../schema";
import { joinRequests } from "../schema-discord";

const j = joinRequests;

export type JoinRequestRow = typeof joinRequests.$inferSelect;

/** A request is open this many days; then it is no longer shown and the daily tick deletes it. */
export const JOIN_REQUEST_DAYS = 7;

/** The instant before which a request has expired. */
export const joinSince = (now: Date) => new Date(now.getTime() - JOIN_REQUEST_DAYS * 86_400_000);

/**
 * Records one person's request, or replaces their earlier one with what they typed now. True when no open
 * request of theirs was there before (a new one, or one that had expired), so the leaders hear of it once.
 */
export async function recordJoinRequest(
  db: Db,
  row: { workspaceId: number; discordUserId: string; discordName: string; typed: string; at: Date },
  since: Date,
): Promise<boolean> {
  const [before] = await db
    .select({ createdAt: j.createdAt })
    .from(j)
    .where(and(eq(j.workspaceId, row.workspaceId), eq(j.discordUserId, row.discordUserId)));
  await db
    .insert(j)
    .values({
      workspaceId: row.workspaceId,
      discordUserId: row.discordUserId,
      discordName: row.discordName,
      typed: row.typed,
      createdAt: row.at,
    })
    .onConflictDoUpdate({
      target: [j.workspaceId, j.discordUserId],
      set: { discordName: row.discordName, typed: row.typed, createdAt: row.at },
    });
  return !before || before.createdAt <= since;
}

/** The workspace's open requests, the oldest first. */
export async function openJoinRequests(
  db: Db,
  workspaceId: number,
  since: Date,
): Promise<JoinRequestRow[]> {
  return db
    .select()
    .from(j)
    .where(and(eq(j.workspaceId, workspaceId), gt(j.createdAt, since)))
    .orderBy(asc(j.createdAt), asc(j.id));
}

/** One open request of the workspace, or null. */
export async function findJoinRequest(
  db: Db,
  workspaceId: number,
  id: number,
  since: Date,
): Promise<JoinRequestRow | null> {
  const [row] = await db
    .select()
    .from(j)
    .where(and(eq(j.workspaceId, workspaceId), eq(j.id, id), gt(j.createdAt, since)));
  return row ?? null;
}

/** Deletes one request of the workspace; false when it was gone already (another officer answered it). */
export async function deleteJoinRequest(db: Db, workspaceId: number, id: number): Promise<boolean> {
  const done = await db
    .delete(j)
    .where(and(eq(j.workspaceId, workspaceId), eq(j.id, id)))
    .returning({ id: j.id });
  return done.length > 0;
}

/**
 * The workspace user of the Discord account an officer approved, made when they have none yet (a row grants
 * nothing by itself: the sign-in still needs a role, D71). Their name is the request's until they sign in.
 */
export async function joinUser(
  db: Db,
  workspaceId: number,
  discordUserId: string,
  displayName: string,
): Promise<number> {
  const [row] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId, displayName })
    .onConflictDoUpdate({
      target: [workspaceUsers.workspaceId, workspaceUsers.discordUserId],
      set: { displayName: sql`coalesce(${workspaceUsers.displayName}, excluded.display_name)` },
    })
    .returning({ id: workspaceUsers.id });
  if (!row) throw new Error("workspace user upsert returned no row");
  return row.id;
}

/** INVARIANT join-requests.expire: deletes every workspace's requests made at or before `since`. */
export async function purgeOldJoinRequests(db: Db, since: Date): Promise<number> {
  const done = await db.delete(j).where(lte(j.createdAt, since)).returning({ id: j.id });
  return done.length;
}
