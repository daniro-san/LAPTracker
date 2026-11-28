// Home's recent activity (D108): records deleted, as more parts of lib/repo/desk-activity.ts's small-sources
// union read. Notices deleted and restored from the trash (D118); Calendar entries, thefts and new members
// deleted (D123); follow-up records deleted and review requests withdrawn (D123 phase 2). Who, when and
// which record: never a theft's people or note, nor a follow-up's choice or note. An undone delete is not one
// (Undo clears `deleted_at`). Roll calls have their own parts (./desk-activity-calls, D120).
import { sql } from "drizzle-orm";

/**
 * The parts, each its own newest `n` since `since` and before `before`, in the union's columns. A D123 part
 * carries the record's id in `uid`, so two deletes are never folded into one line.
 */
export const trashParts = (ws: number, since: string, before: string, n: number) => sql`
    union all
    (select 'noticeDeleted', n.deleted_by, n.deleted_at, n.id, null, null, null, null, null
      from notices n
      where n.workspace_id = ${ws} and n.deleted_at >= ${since} and n.deleted_at < ${before}
        and n.deleted_by is not null
      order by n.deleted_at desc limit ${n})
    union all
    (select 'noticeRestored', n.restored_by, n.restored_at, n.id, null, null, null, null, null
      from notices n
      where n.workspace_id = ${ws} and n.restored_at >= ${since} and n.restored_at < ${before}
        and n.restored_by is not null
      order by n.restored_at desc limit ${n})
    union all
    (select 'entryDeleted', c.deleted_by, c.deleted_at, null, c.kind, c.variant, c.level, c.title, c.id
      from calendar_entries c
      where c.workspace_id = ${ws} and c.deleted_at >= ${since} and c.deleted_at < ${before}
        and c.deleted_by is not null
      order by c.deleted_at desc limit ${n})
    union all
    (select 'theftDeleted', t.deleted_by, t.deleted_at, null, null, null, null, null, t.id
      from thefts t
      where t.workspace_id = ${ws} and t.deleted_at >= ${since} and t.deleted_at < ${before}
        and t.deleted_by is not null
      order by t.deleted_at desc limit ${n})
    union all
    (select 'newMemberDeleted', m.deleted_by, m.dismissed_at, null, null, null, null, m.name, m.id
      from pending_members m
      where m.workspace_id = ${ws} and m.dismissed_at >= ${since} and m.dismissed_at < ${before}
        and m.deleted_by is not null and m.matched_uid is null
      order by m.dismissed_at desc limit ${n})
    union all
    (select 'followUpDeleted', f.deleted_by, f.deleted_at, null, null, null, null, null, f.uid
      from member_follow_ups f
      where f.workspace_id = ${ws} and f.deleted_at >= ${since} and f.deleted_at < ${before}
        and f.deleted_by is not null
      order by f.deleted_at desc limit ${n})
    union all
    (select 'reviewWithdrawn', r.deleted_by, r.deleted_at, r.notice_id, null, null, null, null, null
      from notice_reviews r
      where r.workspace_id = ${ws} and r.deleted_at >= ${since} and r.deleted_at < ${before}
        and r.deleted_by is not null
      order by r.deleted_at desc limit ${n})`;

export type TrashKind =
  | "noticeDeleted"
  | "noticeRestored"
  | "entryDeleted"
  | "theftDeleted"
  | "newMemberDeleted"
  | "followUpDeleted"
  | "reviewWithdrawn";

/** A notice's delete or restore: who, when and which notice. */
export interface TrashDone {
  by: number;
  at: Date;
  noticeId: number;
}

/** A deleted Calendar entry: its title's parts, as the line "added … to the Calendar" has them. */
interface EntryDeleted {
  kind: "entryDeleted";
  by: number;
  at: Date;
  id: number;
  entry: { kind: string; variant: string | null; level: number | null; title: string | null };
}

/** A deleted theft: only which row, never its people (D75). */
interface TheftDeleted {
  kind: "theftDeleted";
  by: number;
  at: Date;
  id: number;
}

/** A deleted new member: their name as the officer typed it. */
interface NewMemberDeleted {
  kind: "newMemberDeleted";
  by: number;
  at: Date;
  id: number;
  name: string;
}

/** A follow-up record deleted from a member's history (D123 phase 2): whose, never the choice or note. */
export interface FollowUpDeleted {
  kind: "followUpDeleted";
  by: number;
  at: Date;
  uid: number;
}

/** A D123 delete as a line of the feed, never folded into another line. */
export type DeleteLine =
  | Omit<EntryDeleted, "by" | "at">
  | Omit<TheftDeleted, "by" | "at">
  | Omit<NewMemberDeleted, "by" | "at">;

/** One list per part: the feed's paging horizon reads each source's rows apart (D108). */
export interface TrashRows {
  noticeDeletes: TrashDone[];
  noticeRestores: TrashDone[];
  /** Review requests withdrawn (D123 phase 2), by their notice. */
  reviewWithdraws: TrashDone[];
  entryDeletes: EntryDeleted[];
  theftDeletes: TheftDeleted[];
  newMemberDeletes: NewMemberDeleted[];
  followUpDeletes: FollowUpDeleted[];
}

type Row = {
  by: number;
  at: Date;
  a: string | null;
  b: string | null;
  level: number | null;
  title: string | null;
  uid: number | string | null;
};

/** The parts' rows, from the union's readers of notice rows and of rows by kind. */
export const trashRows = (
  notice: (kind: "noticeDeleted" | "noticeRestored" | "reviewWithdrawn") => TrashDone[],
  of: (kind: TrashKind) => Row[],
): TrashRows => ({
  noticeDeletes: notice("noticeDeleted"),
  noticeRestores: notice("noticeRestored"),
  reviewWithdraws: notice("reviewWithdrawn"),
  followUpDeletes: of("followUpDeleted").map(({ by, at, uid }) => ({
    kind: "followUpDeleted",
    by,
    at,
    uid: Number(uid),
  })),
  entryDeletes: of("entryDeleted").map(({ by, at, a, b, level, title, uid }) => ({
    kind: "entryDeleted",
    by,
    at,
    id: Number(uid),
    entry: { kind: a ?? "", variant: b, level, title },
  })),
  theftDeletes: of("theftDeleted").map(({ by, at, uid }) => ({
    kind: "theftDeleted",
    by,
    at,
    id: Number(uid),
  })),
  newMemberDeletes: of("newMemberDeleted").map(({ by, at, title, uid }) => ({
    kind: "newMemberDeleted",
    by,
    at,
    id: Number(uid),
    name: title ?? "",
  })),
});
