// Home's recent activity (D108): the alliance's tracker key saved or removed (D124), as one more part of
// lib/repo/desk-activity.ts's small-sources union read. Who, when and which action: never the key.
import { sql } from "drizzle-orm";

export type Kind = "trackerKey";

/** The tracker key set (or replaced) or removed. */
export interface KeyDone {
  kind: Kind;
  by: number;
  at: Date;
  action: "set" | "removed";
}

/** The part, its own newest `n` since `since` and before `before`, in the union's columns (`a`: the action). */
export const parts = (ws: number, since: string, before: string, n: number) => sql`
    union all
    (select 'trackerKey', k.changed_by, k.changed_at, null, k.action, null, null, null, null
      from workspace_key_changes k
      where k.workspace_id = ${ws} and k.changed_by is not null
        and k.changed_at >= ${since} and k.changed_at < ${before}
      order by k.changed_at desc limit ${n})`;

/** The part's rows, from the union's reader of rows by kind. */
export const rows = (of: (kind: Kind) => { by: number; at: Date; a: string | null }[]) => ({
  keyChanges: of("trackerKey").map(({ by, at, a }): KeyDone => ({
    kind: "trackerKey",
    by,
    at,
    action: a as KeyDone["action"],
  })),
});
