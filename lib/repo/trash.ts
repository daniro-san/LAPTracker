// The one soft delete every officer-owned record uses (D123, from D118 and D120): the row stays, with who
// deleted it, when and under which request id (D100). A delete is replay-safe, also after its Undo; Undo is
// the deleter's own, within UNDO_MS; a restore from the trash (D118) is any officer's, at any time. Each
// table names these columns `deletedAt`, `deletedBy` and `deleteRequestId` (and `restoredAt`, `restoredBy`,
// `restoreRequestId` for a restore), and every other read of it keeps `live(table)`.
import { and, eq, gt, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn, PgTable, PgUpdateSetSource } from "drizzle-orm/pg-core";

import type { Db } from "../db";

/** How long the officer who deleted a record may still take it back; the pages offer it for less. */
export const UNDO_MS = 60_000;

/** A table whose rows officers delete softly. */
export type Trashable = PgTable & {
  id: PgColumn;
  workspaceId: PgColumn;
  deletedAt: PgColumn;
  deletedBy: PgColumn;
  deleteRequestId: PgColumn;
};

/** A table whose deleted rows can also be restored from the trash (D118). */
export type Restorable = Trashable & {
  restoredAt: PgColumn;
  restoredBy: PgColumn;
  restoreRequestId: PgColumn;
};

/** One delete, Undo or restore: which row of which workspace, by whom, when, under which request id. */
export interface TrashChange {
  workspaceId: number;
  id: number;
  userId: number;
  requestId: string;
  now: Date;
}

/** Not deleted: the condition on every read of a trashable table. */
export const live = (t: Trashable) => isNull(t.deletedAt);

const mine = (t: Trashable, c: TrashChange) =>
  and(eq(t.workspaceId, c.workspaceId), eq(t.id, c.id));

/** Sets these columns; the table's own keys, typed by the caller's table. */
async function set<T extends Trashable>(db: Db, t: T, values: object, where: SQL | undefined) {
  const [done] = await db
    .update(t)
    .set(values as PgUpdateSetSource<T>)
    .where(where)
    .returning({ id: t.id });
  return done !== undefined;
}

/** Whether the workspace has a row of this table that `column` names with this request id. */
async function seen(db: Db, t: Trashable, c: TrashChange, column: PgColumn) {
  const [again] = await db
    .select({ id: t.id })
    .from(t)
    .where(and(mine(t, c), eq(column, c.requestId)));
  return again !== undefined;
}

/**
 * Deletes a live row (that `guard`, a table's own rule, allows). A retry under the same request id finds
 * its own delete and is true without writing, also after that delete was undone (a late replay must not
 * delete again); false when the workspace has no such live row.
 */
export async function softDelete<T extends Trashable>(
  db: Db,
  t: T,
  c: TrashChange,
  guard?: SQL,
): Promise<boolean> {
  const done = await set(
    db,
    t,
    { deletedAt: c.now, deletedBy: c.userId, deleteRequestId: c.requestId },
    and(mine(t, c), live(t), guard, sql`${t.deleteRequestId} is distinct from ${c.requestId}`),
  );
  return done || seen(db, t, c, t.deleteRequestId);
}

/** The Postgres error code, on the error or on the driver error it wraps. */
const pgCode = (e: unknown) => {
  const err = e as { code?: unknown; cause?: { code?: unknown } } | null;
  return err?.code ?? err?.cause?.code;
};

/**
 * Undoes the officer's own delete made under `requestId` in the last UNDO_MS. A repeat of an Undo that
 * worked is true again. False otherwise: someone else's, too late, or `guard` (a table's own rule, such as
 * "no new live row took its place") says no. A new row made at the same instant passes the guard and then
 * fails a live unique index (23505): that is a refusal too.
 */
export async function undoDelete<T extends Trashable>(
  db: Db,
  t: T,
  c: TrashChange,
  guard?: SQL,
): Promise<boolean> {
  const since = new Date(c.now.getTime() - UNDO_MS);
  try {
    return await set(
      db,
      t,
      { deletedAt: null },
      and(
        mine(t, c),
        eq(t.deleteRequestId, c.requestId),
        eq(t.deletedBy, c.userId),
        or(live(t), gt(t.deletedAt, since)),
        guard,
      ),
    );
  } catch (error) {
    if (pgCode(error) === "23505") return false;
    throw error;
  }
}

/**
 * Restores a deleted row from the trash (D118): any officer of the workspace, at any time, recorded with
 * who, when and the request id. A repeat of the same restore is true without writing. False when the
 * workspace has no such deleted row.
 */
export async function restoreDeleted<T extends Restorable>(
  db: Db,
  t: T,
  c: TrashChange,
): Promise<boolean> {
  const done = await set(
    db,
    t,
    { deletedAt: null, restoredAt: c.now, restoredBy: c.userId, restoreRequestId: c.requestId },
    and(
      mine(t, c),
      isNotNull(t.deletedAt),
      sql`${t.restoreRequestId} is distinct from ${c.requestId}`,
    ),
  );
  return done || seen(db, t, c, t.restoreRequestId);
}

/** Whether the workspace has this row in the trash: a save to it says so, not "not found". */
export async function isDeleted(
  db: Db,
  t: Trashable,
  workspaceId: number,
  id: number,
): Promise<boolean> {
  const [row] = await db
    .select({ id: t.id })
    .from(t)
    .where(and(eq(t.workspaceId, workspaceId), eq(t.id, id), isNotNull(t.deletedAt)));
  return row !== undefined;
}
