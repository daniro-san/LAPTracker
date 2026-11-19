// Home's recent activity (D108): roll calls deleted and archived (D120), as two more parts of
// lib/repo/desk-activity.ts's small-sources union read. Who, when and which kind of roll call. An undone
// delete is not one (Undo clears `deleted_at`), nor an archive taken back (Unarchive clears `archived_at`).
import { sql } from "drizzle-orm";

/**
 * The two parts, each its own newest `n` since `since` and before `before`, in the union's columns (`a`
 * kind, `b` team, `level` the roll call's id).
 */
export const callParts = (ws: number, since: string, before: string, n: number) => sql`
    union all
    (select 'callDeleted', c.deleted_by, c.deleted_at, null, c.kind, c.variant, c.id, null, null
      from roll_calls c
      where c.workspace_id = ${ws} and c.deleted_at >= ${since} and c.deleted_at < ${before}
        and c.deleted_by is not null
      order by c.deleted_at desc limit ${n})
    union all
    (select 'callArchived', c.archived_by, c.archived_at, null, c.kind, c.variant, c.id, null, null
      from roll_calls c
      where c.workspace_id = ${ws} and c.archived_at >= ${since} and c.archived_at < ${before}
        and c.archived_by is not null
        and c.deleted_at is null
      order by c.archived_at desc limit ${n})`;

export type CallKind = "callDeleted" | "callArchived";

/**
 * A delete or an archive, as a line of the feed: who, when, and the roll call's kind and team. `callId`
 * keeps two roll calls of one kind apart, so a delete or an archive is never folded into another line.
 */
export interface CallDone {
  kind: CallKind;
  by: number;
  at: Date;
  callId: number;
  call: { kind: string; variant: string | null };
}

/** Two lists, one per part: the feed's paging horizon reads each source's rows apart (D108). */
export interface CallRows {
  callDeletes: CallDone[];
  callArchives: CallDone[];
}

type Row = { by: number; at: Date; a: string | null; b: string | null; level: number | null };

/** The two parts' rows, from the union's reader of rows by kind. */
export const callRows = (of: (kind: CallKind) => Row[]): CallRows => {
  const done = (kind: CallKind) =>
    of(kind).map(({ by, at, a, b, level }) => ({
      kind,
      by,
      at,
      callId: Number(level),
      call: { kind: a ?? "", variant: b },
    }));
  return { callDeletes: done("callDeleted"), callArchives: done("callArchived") };
};
