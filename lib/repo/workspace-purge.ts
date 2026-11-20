// "Delete this workspace" (D125): asked by an officer or the site's owner, it waits 14 days, any officer (or
// the owner) can cancel it, and then the daily job deletes every row the workspace owns in one transaction
// (lib/repo/workspace-data.ts lists them) and leaves a tombstone for /admin. Public data stays: the ledger,
// the rosters and the alliance's public pages are not the workspace's.
import { and, asc, count, eq, inArray, isNotNull, isNull, lte } from "drizzle-orm";

import type { Db } from "../db";
import { authAttempts, workspaces, workspaceUsers } from "../schema";
import { workspaceTombstones } from "../schema-retention";
import { allianceLabelOf } from "./alliances";
import { DAY_KEY_PREFIX } from "./auth-attempts";
import { ownedBy, WORKSPACE_TABLES } from "./workspace-data";

/** The grace period: everyone keeps access, can download, and any officer can cancel. */
export const DELETION_GRACE_MS = 14 * 24 * 60 * 60_000;

/** The download's daily count in auth_attempts (D125), per workspace. */
export const exportLimitKey = (workspaceId: number) => `${DAY_KEY_PREFIX}export:ws:${workspaceId}`;

/**
 * Asks to delete the workspace, `by` a workspace user (null: the site's owner). A deletion already asked
 * stays as it was. The instant after which the daily job deletes it; null when there is no such workspace.
 */
export async function askDeletion(
  db: Db,
  workspaceId: number,
  by: number | null,
  now: Date,
): Promise<{ purgeAfter: Date; asked: boolean } | null> {
  const purgeAfter = new Date(now.getTime() + DELETION_GRACE_MS);
  const [asked] = await db
    .update(workspaces)
    .set({ deletionRequestedAt: now, deletionRequestedBy: by, purgeAfter })
    .where(and(eq(workspaces.id, workspaceId), isNull(workspaces.purgeAfter)))
    .returning({ purgeAfter: workspaces.purgeAfter });
  if (asked?.purgeAfter) return { purgeAfter: asked.purgeAfter, asked: true };
  const [row] = await db
    .select({ purgeAfter: workspaces.purgeAfter })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId));
  return row?.purgeAfter ? { purgeAfter: row.purgeAfter, asked: false } : null;
}

/** Cancels an asked deletion; false when none was asked. */
export async function cancelDeletion(db: Db, workspaceId: number): Promise<boolean> {
  const rows = await db
    .update(workspaces)
    .set({ deletionRequestedAt: null, deletionRequestedBy: null, purgeAfter: null })
    .where(and(eq(workspaces.id, workspaceId), isNotNull(workspaces.purgeAfter)))
    .returning({ id: workspaces.id });
  return rows.length > 0;
}

type Due = Pick<typeof workspaces.$inferSelect, "id" | "unionId">;

/** How many rows each table held for the workspace: counts only, for the log. */
async function countRows(db: Pick<Db, "select">, w: Due): Promise<number> {
  const counts = await Promise.all(
    WORKSPACE_TABLES.map(async (t) => {
      const [row] = await db.select({ n: count() }).from(t.table).where(ownedBy(t, w));
      return row?.n ?? 0;
    }),
  );
  return counts.reduce((a, b) => a + b, 0);
}

/**
 * One workspace deleted for good, in one transaction, if its grace period still ended by `now`: the row is
 * locked first (`for update`), so a cancel that came in after the job listed it wins and the workspace
 * stays. Then its rows by alliance (the squads read on its key) and its rate-limit counters, then the
 * workspace row, whose foreign keys take every other owned row with it (pictures, the key, sessions, the
 * allowlist and the activity included). The tombstone, built from the locked row, replaces it. Returns how
 * many owned rows went, or null when it was not due any more.
 */
export async function purgeWorkspace(db: Db, id: number, now: Date): Promise<number | null> {
  return db.transaction(async (tx) => {
    const [w] = await tx
      .select()
      .from(workspaces)
      .where(and(eq(workspaces.id, id), lte(workspaces.purgeAfter, now)))
      .for("update");
    if (!w) return null;
    const rows = await countRows(tx, w);
    const users = await tx
      .select({ id: workspaceUsers.id })
      .from(workspaceUsers)
      .where(eq(workspaceUsers.workspaceId, w.id));
    for (const t of WORKSPACE_TABLES.filter((t) => t.scope === "union")) {
      await tx.delete(t.table).where(ownedBy(t, w));
    }
    const counters = [
      exportLimitKey(w.id),
      `keytest:ws:${w.id}`,
      ...users.map((u) => `keytest:user:${u.id}`),
    ];
    await tx.delete(authAttempts).where(inArray(authAttempts.key, counters));
    await tx.delete(workspaces).where(eq(workspaces.id, w.id));
    const alliance = await allianceLabelOf(tx, w.unionId);
    // Who asked: the owner or an officer, never the officer's name (review of PR 449).
    await tx.insert(workspaceTombstones).values({
      slug: w.slug,
      unionId: w.unionId,
      alliance: alliance ? `${alliance.tag} · ${alliance.name}` : null,
      byOwner: w.deletionRequestedBy === null,
      requestedAt: w.deletionRequestedAt ?? now,
      purgedAt: now,
    });
    return rows;
  });
}

/** What one run of the daily job did: counts, and the error class of each workspace that failed. */
export interface PurgeOutcome {
  workspaces: number;
  rows: number;
  failed: string[];
}

/**
 * The daily job (D125): every workspace whose grace period ended by `now` is deleted, each in its own
 * transaction. One that fails is rolled back and counted, and the others still go.
 */
export async function purgeDueWorkspaces(db: Db, now: Date): Promise<PurgeOutcome> {
  const due = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(lte(workspaces.purgeAfter, now))
    .orderBy(asc(workspaces.id));
  const out: PurgeOutcome = { workspaces: 0, rows: 0, failed: [] };
  for (const { id } of due) {
    try {
      const rows = await purgeWorkspace(db, id, now);
      if (rows === null) continue;
      out.workspaces += 1;
      out.rows += rows;
    } catch (error: unknown) {
      out.failed.push(error instanceof Error ? error.name : "unknown");
    }
  }
  return out;
}
