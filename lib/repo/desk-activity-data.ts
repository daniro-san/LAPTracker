// Home's recent activity (D108): the alliance's data downloaded, its deletion asked or cancelled (D125), as
// one more part of lib/repo/desk-activity.ts's small-sources union read. The site's owner's actions on
// /admin have no officer, so they give no line (the banner says the deletion is asked).
import { sql } from "drizzle-orm";

import type { DataAction } from "../schema-retention";

export type Kind = "workspaceData";

/** "Download our data", "Delete this workspace" or "Cancel the deletion". */
export interface DataDone {
  kind: Kind;
  by: number;
  at: Date;
  action: DataAction;
}

/** The part, its own newest `n` since `since` and before `before`, in the union's columns (`a`: the action). */
export const parts = (ws: number, since: string, before: string, n: number) => sql`
    union all
    (select 'workspaceData', d.by, d.at, null, d.action, null, null, null, null
      from workspace_data_events d
      where d.workspace_id = ${ws} and d.by is not null
        and d.at >= ${since} and d.at < ${before}
      order by d.at desc limit ${n})`;

/** The part's rows, from the union's reader of rows by kind. */
export const rows = (of: (kind: Kind) => { by: number; at: Date; a: string | null }[]) => ({
  dataEvents: of("workspaceData").map(({ by, at, a }): DataDone => ({
    kind: "workspaceData",
    by,
    at,
    action: a as DataAction,
  })),
});
