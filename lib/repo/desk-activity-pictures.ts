// Home's recent activity (D108): a notice's picture added or replaced (D119), as one more part of
// lib/repo/desk-activity.ts's small-sources union read. Who, when and which notice: the current picture of
// each notice, so a replace is one line at its new time and a removal has none.
import { sql } from "drizzle-orm";

/** The part, its own newest `n` since `since` and before `before` (the page's cursor), in the union's columns. */
export const parts = (ws: number, since: string, before: string, n: number) => sql`
    union all
    (select 'noticePicture', g.added_by, g.added_at, g.notice_id, null, null, null, null, null
      from notice_pictures g
      where g.workspace_id = ${ws} and g.added_by is not null and g.added_at >= ${since}
        and g.added_at < ${before}
      order by g.added_at desc limit ${n})`;

export type Kind = "noticePicture";

export interface Rows {
  noticePictures: { by: number; at: Date; noticeId: number }[];
}

/** The part's rows, typed by the union's reader of notice rows. */
export const rows = (notice: (kind: Kind) => Rows["noticePictures"]): Rows => ({
  noticePictures: notice("noticePicture"),
});
