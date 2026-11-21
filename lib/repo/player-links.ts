// "This is me" links (D87, D142): which workspace user says which player of the alliance they are. One
// player per user (the row's own player_uid) and one approved link per player in a workspace (a partial
// unique index). A pending claim reserves nothing; when a link is approved, the other pending claims of
// that player go. Every function takes the workspace id; lib/private passes its
// access's own. Officers name a link by its user, so an answer never reaches a later claim of the player.
import { and, asc, eq, isNotNull, ne, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaceUsers } from "../schema";

export type LinkState = "approved" | "pending";

/** The Postgres error code, on the error or on the driver error it wraps. */
const pgCode = (e: unknown) => {
  const err = e as { code?: unknown; cause?: { code?: unknown } } | null;
  return err?.code ?? err?.cause?.code;
};

const none = { playerUid: null, playerLink: null, playerLinkedAt: null };

/** The other users' pending claims of a player that has just been linked. */
async function dropOtherClaims(db: Db, workspaceId: number, uid: number, userId: number) {
  await db
    .update(workspaceUsers)
    .set(none)
    .where(
      and(
        eq(workspaceUsers.workspaceId, workspaceId),
        eq(workspaceUsers.playerUid, uid),
        eq(workspaceUsers.playerLink, "pending"),
        ne(workspaceUsers.id, userId),
      ),
    );
}

/** Runs an update that may open a link; "taken" when the unique index says another user holds it. */
async function opening(write: () => Promise<{ id: number }[]>): Promise<"ok" | "taken" | "none"> {
  try {
    return (await write()).length > 0 ? "ok" : "none";
  } catch (error) {
    if (pgCode(error) === "23505") return "taken";
    throw error;
  }
}

/**
 * Links the user to `uid` in `state`, only while no other user of the workspace holds that player with an
 * open link. "taken" when one does (also when two claims race and the unique index refuses the second).
 */
export async function setLink(
  db: Db,
  workspaceId: number,
  userId: number,
  link: { uid: number; state: LinkState; at: Date },
): Promise<"ok" | "taken"> {
  const done = await opening(() =>
    db
      .update(workspaceUsers)
      .set({ playerUid: link.uid, playerLink: link.state, playerLinkedAt: link.at })
      .where(
        and(
          eq(workspaceUsers.id, userId),
          eq(workspaceUsers.workspaceId, workspaceId),
          sql`not exists (select 1 from ${workspaceUsers} o where o.workspace_id = ${workspaceId} and o.player_uid = ${link.uid} and o.player_link = 'approved' and o.id <> ${userId})`,
        ),
      )
      .returning({ id: workspaceUsers.id }),
  );
  if (done !== "ok") return "taken";
  if (link.state !== "pending") await dropOtherClaims(db, workspaceId, link.uid, userId);
  return "ok";
}

/** Removes one user's link: the member's own, or an officer's Reject or Remove. False when there is none. */
export async function clearLink(db: Db, workspaceId: number, userId: number): Promise<boolean> {
  const done = await db
    .update(workspaceUsers)
    .set(none)
    .where(
      and(
        eq(workspaceUsers.workspaceId, workspaceId),
        eq(workspaceUsers.id, userId),
        isNotNull(workspaceUsers.playerUid),
      ),
    )
    .returning({ id: workspaceUsers.id });
  return done.length > 0;
}

/**
 * An officer's Approve: the user's pending link becomes approved. "taken" when
 * another user holds the player meanwhile; "none" when the user has no such link.
 */
export async function approveLink(
  db: Db,
  workspaceId: number,
  userId: number,
): Promise<"ok" | "taken" | "none"> {
  const rows: { id: number; uid: number | null }[] = [];
  const done = await opening(async () => {
    const r = await db
      .update(workspaceUsers)
      .set({ playerLink: "approved" })
      .where(
        and(
          eq(workspaceUsers.workspaceId, workspaceId),
          eq(workspaceUsers.id, userId),
          eq(workspaceUsers.playerLink, "pending"),
        ),
      )
      .returning({ id: workspaceUsers.id, uid: workspaceUsers.playerUid });
    rows.push(...r);
    return r;
  });
  const uid = rows[0]?.uid;
  if (done === "ok" && uid != null) await dropOtherClaims(db, workspaceId, uid, userId);
  return done;
}

export interface LinkRow {
  /** The workspace user who holds the link: what an officer's answer names. */
  userId: number;
  uid: number;
  state: LinkState;
  /** The name Discord gave at the user's last sign-in (the server nickname first). */
  discordName: string | null;
  at: Date | null;
}

const linkColumns = {
  userId: workspaceUsers.id,
  uid: sql<number>`${workspaceUsers.playerUid}`.mapWith(Number),
  state: sql<LinkState>`${workspaceUsers.playerLink}`,
  discordName: workspaceUsers.displayName,
  at: workspaceUsers.playerLinkedAt,
};

/** The links to one player of the workspace: the open one first, then the claims, the oldest first. */
export async function linksOfPlayer(db: Db, workspaceId: number, uid: number): Promise<LinkRow[]> {
  return db
    .select(linkColumns)
    .from(workspaceUsers)
    .where(and(eq(workspaceUsers.workspaceId, workspaceId), eq(workspaceUsers.playerUid, uid)))
    .orderBy(
      sql`${workspaceUsers.playerLink} = 'pending'`,
      asc(workspaceUsers.playerLinkedAt),
      asc(workspaceUsers.id),
    );
}

/** The links waiting for an officer, the oldest first. */
export async function linksToReview(db: Db, workspaceId: number): Promise<LinkRow[]> {
  return db
    .select(linkColumns)
    .from(workspaceUsers)
    .where(
      and(eq(workspaceUsers.workspaceId, workspaceId), eq(workspaceUsers.playerLink, "pending")),
    )
    .orderBy(asc(workspaceUsers.playerLinkedAt), asc(workspaceUsers.id));
}
