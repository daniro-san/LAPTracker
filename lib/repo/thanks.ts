// thanks_shares and thanks_takedowns (D114): a share is claimed under its request id before anything is
// posted (D100), then marked posted or failed; the board reads the newest board share, unless an officer
// took it down. Rows are only appended (the status of a Discord share is the one update).
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";

import type { Db } from "../db";
import { workspaceUsers } from "../schema";
import { thanksShares, thanksTakedowns } from "../schema-board";
import { COOLDOWN_MS } from "./notice-publishes";

export type ShareTarget = "discord" | "board";

export interface ShareClaim {
  workspaceId: number;
  requestId: string;
  target: ShareTarget;
  week: string;
  texts: Partial<Record<string, string>>;
  names: string[];
  userId: number;
  now: Date;
}

export interface ShareRow {
  id: number;
  target: string;
  week: string;
  status: string;
  at: Date;
}

const columns = {
  id: thanksShares.id,
  target: thanksShares.target,
  week: thanksShares.week,
  status: thanksShares.status,
  at: thanksShares.sharedAt,
};

async function byRequest(db: Db, workspaceId: number, requestId: string) {
  const [row] = await db
    .select(columns)
    .from(thanksShares)
    .where(and(eq(thanksShares.workspaceId, workspaceId), eq(thanksShares.requestId, requestId)));
  return row ?? null;
}

/** A share of the same week to the same place, running or posted, in the last COOLDOWN_MS (D102). */
async function recentOne(db: Db, c: ShareClaim): Promise<boolean> {
  const [row] = await db
    .select({ id: thanksShares.id })
    .from(thanksShares)
    // thanks_shares_workspace_idx (workspace_id, target, id): the newest shares to that place.
    .where(
      and(
        eq(thanksShares.workspaceId, c.workspaceId),
        eq(thanksShares.target, c.target),
        eq(thanksShares.week, c.week),
        inArray(thanksShares.status, ["posting", "posted"]),
        gt(thanksShares.sharedAt, new Date(c.now.getTime() - COOLDOWN_MS)),
      ),
    )
    .orderBy(desc(thanksShares.id))
    .limit(1);
  return row !== undefined;
}

/**
 * The claim. `claimed`: a new row ("posting" for Discord, "posted" for the board). `earlier`: the row this
 * request id already made (a double tap, a retry, or one at the same moment that lost on the unique index).
 * `recent`: the same week went to the same place in the last 30 s (two officers, or two sheets), so
 * nothing is claimed.
 */
export async function claimShare(
  db: Db,
  c: ShareClaim,
): Promise<{ kind: "claimed" | "earlier"; row: ShareRow } | { kind: "recent" }> {
  const known = await byRequest(db, c.workspaceId, c.requestId);
  if (known) return { kind: "earlier", row: known };
  if (await recentOne(db, c)) return { kind: "recent" };
  const [made] = await db
    .insert(thanksShares)
    .values({
      workspaceId: c.workspaceId,
      requestId: c.requestId,
      target: c.target,
      week: c.week,
      texts: c.texts,
      names: c.names,
      status: c.target === "board" ? "posted" : "posting",
      sharedBy: c.userId,
      sharedAt: c.now,
    })
    .onConflictDoNothing({ target: [thanksShares.workspaceId, thanksShares.requestId] })
    .returning({ id: thanksShares.id });
  const row = await byRequest(db, c.workspaceId, c.requestId);
  if (!row) throw new Error("thanks_claim_lost");
  return { kind: made === undefined ? "earlier" : "claimed", row };
}

export async function finishShare(db: Db, id: number, status: "posted" | "failed"): Promise<void> {
  await db.update(thanksShares).set({ status }).where(eq(thanksShares.id, id));
}

export interface BoardThanksRow {
  id: number;
  week: string;
  texts: Partial<Record<string, string>>;
  /** The people the officer named: the card sets them in bold. */
  names: string[];
  /** The officer's name in the desk (chosen, else Discord's); null when the account is gone. */
  by: string | null;
}

/**
 * The thank-you on the members' board: the newest board share, until the next one replaces it; null when
 * an officer took that one down (an older one never comes back).
 */
export async function boardThanks(db: Db, workspaceId: number): Promise<BoardThanksRow | null> {
  const [row] = await db
    .select({
      id: thanksShares.id,
      week: thanksShares.week,
      texts: thanksShares.texts,
      names: thanksShares.names,
      by: sql<string | null>`coalesce(${workspaceUsers.chosenName}, ${workspaceUsers.displayName})`,
      down: thanksTakedowns.id,
    })
    .from(thanksShares)
    .leftJoin(workspaceUsers, eq(workspaceUsers.id, thanksShares.sharedBy))
    .leftJoin(thanksTakedowns, eq(thanksTakedowns.shareId, thanksShares.id))
    // thanks_shares_workspace_idx (workspace_id, target, id): the newest board share.
    .where(
      and(
        eq(thanksShares.workspaceId, workspaceId),
        eq(thanksShares.target, "board"),
        eq(thanksShares.status, "posted"),
      ),
    )
    .orderBy(desc(thanksShares.id))
    .limit(1);
  if (!row || row.down !== null) return null;
  return { id: row.id, week: row.week, texts: row.texts, names: row.names, by: row.by };
}

/** Takes the board's thanks `shareId` down; false when it is not this workspace's board share. */
export async function takeDown(
  db: Db,
  workspaceId: number,
  shareId: number,
  userId: number,
  now: Date,
): Promise<boolean> {
  const [share] = await db
    .select({ id: thanksShares.id })
    .from(thanksShares)
    .where(
      and(
        eq(thanksShares.id, shareId),
        eq(thanksShares.workspaceId, workspaceId),
        eq(thanksShares.target, "board"),
      ),
    );
  if (!share) return false;
  // A second Take down (another officer, a double tap) finds the first and adds nothing.
  await db
    .insert(thanksTakedowns)
    .values({ shareId, takenBy: userId, takenAt: now })
    .onConflictDoNothing({ target: thanksTakedowns.shareId });
  return true;
}

/** Whether the week of `monday` was already thanked on Discord or on the board (the Home nudge, D114). */
export async function weekShared(db: Db, workspaceId: number, monday: string): Promise<boolean> {
  const [row] = await db
    .select({ id: thanksShares.id })
    .from(thanksShares)
    .where(
      and(
        eq(thanksShares.workspaceId, workspaceId),
        eq(thanksShares.week, monday),
        eq(thanksShares.status, "posted"),
      ),
    )
    .limit(1);
  return row !== undefined;
}
