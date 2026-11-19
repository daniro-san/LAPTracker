// Home's recent activity (D108): a notice's picture added or replaced, kept from the weekly cleanup, or used
// in another notice (D119), as three more parts of lib/repo/desk-activity.ts's small-sources union read.
// Who, when and which notice (and, for a copy, which notice it came from): the current picture of each
// notice, so a replace is one line at its new time and a removal has none.
import { sql } from "drizzle-orm";

/**
 * The parts, each its own newest `n` since `since` and before `before` (the page's cursor, D108), in the
 * union's columns; a copy's source is in `uid`.
 */
export const parts = (ws: number, since: string, before: string, n: number) => sql`
    union all
    (select 'noticePicture', g.added_by, g.added_at, g.notice_id, null, null, null, null, null
      from notice_pictures g
      where g.workspace_id = ${ws} and g.added_by is not null and g.added_at >= ${since}
        and g.added_at < ${before}
        and g.copied_from is null
      order by g.added_at desc limit ${n})
    union all
    (select 'noticePictureReused', g.added_by, g.added_at, g.notice_id, null, null, null, null,
        g.copied_from
      from notice_pictures g
      where g.workspace_id = ${ws} and g.added_by is not null and g.added_at >= ${since}
        and g.added_at < ${before}
        and g.copied_from is not null
      order by g.added_at desc limit ${n})
    union all
    (select 'noticePictureKept', g.kept_by, g.kept_at, g.notice_id, null, null, null, null, null
      from notice_pictures g
      where g.workspace_id = ${ws} and g.kept_by is not null and g.kept_at >= ${since}
        and g.kept_at < ${before}
      order by g.kept_at desc limit ${n})`;

export type Kind = "noticePicture" | "noticePictureKept" | "noticePictureReused";

type Done = { by: number; at: Date; noticeId: number };

export interface Rows {
  noticePictures: Done[];
  noticePicturesKept: Done[];
  /** `noticeId`: the notice that got the copy; `fromId`: the one it came from. */
  noticePicturesReused: (Done & { fromId: number })[];
}

/** The parts' rows, typed by the union's reader of notice rows; a copy's rows with their `uid`. */
export const rows = (
  notice: (kind: Kind) => Done[],
  reused: { by: number; at: Date; notice_id: number | null; uid: number | string | null }[],
): Rows => ({
  noticePictures: notice("noticePicture"),
  noticePicturesKept: notice("noticePictureKept"),
  noticePicturesReused: reused.map((r) => ({
    by: r.by,
    at: r.at,
    noticeId: Number(r.notice_id),
    fromId: Number(r.uid),
  })),
});
