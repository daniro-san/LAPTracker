// Home's recent activity (D108): a post's own line changed in Alliance settings (#713, D155), as one more part
// of lib/repo/desk-activity.ts's small-sources union read. Who, when and which post: never the text. The
// table keeps one row per post, so only the latest change of each post is a line.
import { sql } from "drizzle-orm";

import type { PostKey } from "../schema-discord";

export type Kind = "callout";

export interface CalloutDone {
  kind: Kind;
  by: number;
  at: Date;
  post: PostKey;
}

/** The part, its own newest `n` since `since` and before `before`, in the union's columns (`a`: the post). */
export const parts = (ws: number, since: string, before: string, n: number) => sql`
    union all
    (select 'callout', c.updated_by, c.updated_at, null, c.post_key, null, null, null, null
      from workspace_post_touches c
      where c.workspace_id = ${ws} and c.updated_by is not null
        and c.updated_at >= ${since} and c.updated_at < ${before}
      order by c.updated_at desc limit ${n})`;

/** The part's rows, from the union's reader of rows by kind. */
export const rows = (of: (kind: Kind) => { by: number; at: Date; a: string | null }[]) => ({
  calloutChanges: of("callout").map(({ by, at, a }): CalloutDone => ({
    kind: "callout",
    by,
    at,
    post: a as PostKey,
  })),
});
