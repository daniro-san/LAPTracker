// Home's recent activity (D108) from the thefts log (D97): thefts added, read on their own, and the steps
// officers set on its attackers (amended 2026-11-19), one more part of lib/repo/desk-activity.ts's
// small-sources union read. Who, when, how many or which step; never an attacker, a victim or a note.
import { and, desc, eq, gte, isNotNull, lt, sql } from "drizzle-orm";

import type { Db } from "../db";
import { thefts, type theftFollowUps } from "../schema-thefts";
import { live } from "./trash";

/**
 * Thefts added: one row per officer and instant (a screenshot's save adds several at once), the newest `n`
 * since `from` and before `before` (the page's cursor).
 */
export function added(db: Db, ws: number, [from, before]: readonly [Date, string], n: number) {
  const t = thefts;
  return db
    .select({
      kind: sql<"thefts">`'thefts'`,
      by: t.createdBy,
      at: t.createdAt,
      count: sql<number>`count(*)`.mapWith(Number),
    })
    .from(t)
    .where(
      and(
        eq(t.workspaceId, ws),
        live(t),
        isNotNull(t.createdBy),
        gte(t.createdAt, from),
        lt(t.createdAt, sql`${before}::timestamptz`),
      ),
    )
    .groupBy(t.createdBy, t.createdAt)
    .orderBy(desc(t.createdAt))
    .limit(n);
}

/** The steps part, its own newest `n` since `since` and before `before`; column `a` is the step. */
export const parts = (ws: number, since: string, before: string, n: number) => sql`
    union all
    (select 'theftStep', s.changed_by, s.changed_at, null, s.state, null, null, null, null
      from theft_follow_ups s
      where s.workspace_id = ${ws} and s.changed_by is not null
        and s.changed_at >= ${since} and s.changed_at < ${before}
        -- An attacker whose thefts were all deleted (D123) has no steps to show.
        and exists (select 1 from thefts t where t.workspace_id = s.workspace_id
          and t.attacker_key = s.attacker_key and t.deleted_at is null)
      order by s.changed_at desc limit ${n})`;

export type Kind = "theftStep";

/** A step set on an attacker: which step only. */
export interface TheftStepDone {
  kind: Kind;
  by: number;
  at: Date;
  state: (typeof theftFollowUps.$inferSelect)["state"];
}

export interface Rows {
  theftSteps: TheftStepDone[];
}

/** The steps part's rows, from the union's reader of rows by kind. */
export const rows = (of: (kind: Kind) => { by: number; at: Date; a: string | null }[]): Rows => ({
  theftSteps: of("theftStep").map(({ by, at, a }) => ({
    kind: "theftStep",
    by,
    at,
    state: a as TheftStepDone["state"],
  })),
});
