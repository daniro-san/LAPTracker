// Home's recent activity (D108): notices deleted and restored from the trash (D118), as two more parts of
// lib/repo/desk-activity.ts's small-sources union read. Who, when and which notice. An undone delete is
// not one: Undo clears `deleted_at`.
import { sql } from "drizzle-orm";

/** The two parts, each its own newest `n` since `since`, in the union's columns. */
export const trashParts = (ws: number, since: string, n: number) => sql`
    union all
    (select 'noticeDeleted', n.deleted_by, n.deleted_at, n.id, null, null, null, null, null
      from notices n
      where n.workspace_id = ${ws} and n.deleted_at >= ${since} and n.deleted_by is not null
      order by n.deleted_at desc limit ${n})
    union all
    (select 'noticeRestored', n.restored_by, n.restored_at, n.id, null, null, null, null, null
      from notices n
      where n.workspace_id = ${ws} and n.restored_at >= ${since} and n.restored_by is not null
      order by n.restored_at desc limit ${n})`;

export type TrashKind = "noticeDeleted" | "noticeRestored";

/** A delete or a restore: who, when and which notice. */
export interface TrashDone {
  by: number;
  at: Date;
  noticeId: number;
}

export interface TrashRows {
  noticeDeletes: TrashDone[];
  noticeRestores: TrashDone[];
}

/** The two parts' rows, typed by the union's reader of notice rows. */
export const trashRows = (notice: (kind: TrashKind) => TrashDone[]): TrashRows => ({
  noticeDeletes: notice("noticeDeleted"),
  noticeRestores: notice("noticeRestored"),
});
