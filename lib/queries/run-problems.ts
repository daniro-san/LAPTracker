import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import type { Db } from "../db";
import { allianceSnapshots } from "../schema";

/** An alliance row of a run that is stale (old `updated_at`) or failed (it has an error). */
export interface RunProblem {
  snapshotId: number;
  unionId: number;
  tag: string | null;
  name: string | null;
  failed: boolean;
}

/** The rows of these snapshots that were not fresh or that failed, by union id. Only the identity and the
 * two flags are read: never the raw roster. */
export async function runProblems(db: Db, snapshotIds: number[]): Promise<RunProblem[]> {
  if (snapshotIds.length === 0) return [];
  return db
    .select({
      snapshotId: allianceSnapshots.snapshotId,
      unionId: allianceSnapshots.unionId,
      tag: allianceSnapshots.tag,
      name: allianceSnapshots.name,
      failed: sql<boolean>`${allianceSnapshots.error} is not null`,
    })
    .from(allianceSnapshots)
    .where(
      and(
        inArray(allianceSnapshots.snapshotId, snapshotIds),
        or(eq(allianceSnapshots.isFresh, false), isNotNull(allianceSnapshots.error)),
      ),
    )
    .orderBy(asc(allianceSnapshots.unionId));
}
