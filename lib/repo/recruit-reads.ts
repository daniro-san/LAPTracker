// recruit_reads (issue 833): how many new tracker reads a workspace's recruit check made on a UTC quota day.
// Counts only: nothing about whom an officer looked up.
import { and, eq, sql } from "drizzle-orm";

import type { Db } from "../db";
import { recruitReads } from "../schema-features";

/**
 * Counts one read on `day`, or refuses it once `cap` are counted: one statement, so two officers pressing at
 * once never pass the cap. The count after this read, or null when the cap was reached (nothing counted).
 */
export async function countRecruitRead(
  db: Db,
  workspaceId: number,
  day: string,
  cap: number,
): Promise<number | null> {
  const result = await db.execute<{ used: number }>(sql`
    insert into ${recruitReads} (workspace_id, day, used)
    select ${workspaceId}, ${day}::date, 1
    where ${cap}::int >= 1
    on conflict (workspace_id, day) do update
      set used = ${recruitReads}.used + 1
      where ${recruitReads}.used < ${cap}::int
    returning used`);
  const [row] = result.rows;
  return row ? Number(row.used) : null;
}

/** The reads counted on `day`: 0 before the first. */
export async function recruitReadsOn(db: Db, workspaceId: number, day: string): Promise<number> {
  const [row] = await db
    .select({ used: recruitReads.used })
    .from(recruitReads)
    .where(and(eq(recruitReads.workspaceId, workspaceId), eq(recruitReads.day, day)));
  return row?.used ?? 0;
}
