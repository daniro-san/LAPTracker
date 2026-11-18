// Home's recent activity (D108): the weekly thanks shared on Discord or the members' board, and taken down
// from the board (D114), as two more parts of lib/repo/desk-activity.ts's small-sources union read. Who,
// when and where: never the text or the names.
import { sql } from "drizzle-orm";

/** The weekly thanks shared (Discord, board) or taken down from the board. */
export interface ThanksDone {
  by: number;
  at: Date;
  target: "discord" | "board" | "down";
}

/** The two parts, each its own newest `n` since `since`, in the union's columns. A failed post is not one. */
export const thanksParts = (ws: number, since: string, n: number) => sql`
    union all
    (select 'thanks', s.shared_by, s.shared_at, null, s.target, null, null, null, null
      from thanks_shares s
      where s.workspace_id = ${ws} and s.status = 'posted' and s.shared_by is not null
        and s.shared_at >= ${since}
      order by s.shared_at desc limit ${n})
    union all
    (select 'thanks', d.taken_by, d.taken_at, null, 'down', null, null, null, null
      from thanks_takedowns d join thanks_shares s on s.id = d.share_id
      where s.workspace_id = ${ws} and d.taken_by is not null and d.taken_at >= ${since}
      order by d.taken_at desc limit ${n})`;
