// "Delete this workspace" (D125): asked by an officer or the site's owner, it waits 14 days, any officer (or
// the owner) can cancel it, and then the daily job deletes every row the workspace owns in one transaction
// (lib/repo/workspace-data.ts lists them) and leaves a tombstone for /admin. Public data stays: the ledger,
// the rosters and the alliance's public pages are not the workspace's.
import { and, asc, count, eq, inArray, isNotNull, isNull, lte, sql } from "drizzle-orm";

import { ALLIANCES } from "../../config/alliances";
import type { Db } from "../db";
import { authAttempts, workspaces, workspaceUsers } from "../schema";
import { workspaceTombstones } from "../schema-retention";
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

type Due = typeof workspaces.$inferSelect;

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

/** The name of the officer who asked, read before their row goes; null for the owner. */
async function askerName(db: Pick<Db, "select">, w: Due): Promise<string | null> {
  if (w.deletionRequestedBy === null) return null;
  const [row] = await db
    .select({
      name: sql<
        string | null
      >`coalesce(${workspaceUsers.chosenName}, ${workspaceUsers.displayName})`,
    })
    .from(workspaceUsers)
    .where(and(eq(workspaceUsers.id, w.deletionRequestedBy), eq(workspaceUsers.workspaceId, w.id)));
  return row?.name ?? null;
}

/**
 * One workspace deleted for good, in one transaction: its rows by alliance (the squads read on its key) and
 * its rate-limit counters, then the workspace row, whose foreign keys take every other owned row with it
 * (pictures, the key, sessions, the allowlist and the activity included). The tombstone replaces it.
 * Returns how many owned rows went.
 */
async function purgeOne(db: Db, w: Due, now: Date): Promise<number> {
  return db.transaction(async (tx) => {
    const rows = await countRows(tx, w);
    const requestedBy = await askerName(tx, w);
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
    const alliance = ALLIANCES.find((a) => a.unionId === w.unionId);
    await tx.insert(workspaceTombstones).values({
      slug: w.slug,
      unionId: w.unionId,
      alliance: alliance ? `${alliance.tag} · ${alliance.name}` : null,
      requestedBy,
      byOwner: w.deletionRequestedBy === null,
      requestedAt: w.deletionRequestedAt ?? now,
      purgedAt: now,
    });
    return rows;
  });
}

/**
 * The daily job (D125): every workspace whose grace period ended by `now` is deleted. Counts only come
 * back: how many workspaces and how many of their rows.
 */
export async function purgeDueWorkspaces(
  db: Db,
  now: Date,
): Promise<{ workspaces: number; rows: number }> {
  const due = await db
    .select()
    .from(workspaces)
    .where(lte(workspaces.purgeAfter, now))
    .orderBy(asc(workspaces.id));
  let rows = 0;
  for (const w of due) rows += await purgeOne(db, w, now);
  return { workspaces: due.length, rows };
}
