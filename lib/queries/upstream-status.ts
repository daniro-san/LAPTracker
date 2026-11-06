// Is the upstream answering? Derived only from rows we already store (DECISIONS D27); never calls it.
// Reads the newest public snapshot and, for the "last fresh" time, the newest fresh alliance row.
import { and, desc, eq, isNull, max } from "drizzle-orm";

import { RUN_STALE_AFTER_MS } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, events, snapshots } from "../schema";
import { publicEvent } from "./visibility";

/** A failed attempt stops counting after this long; the page's own stale marks speak after that. */
export const UPSTREAM_DOWN_WINDOW_MS = 24 * 3_600_000;

/** Row errors the collector writes (lib/upstream-errors.ts `describe`) when the upstream does not answer. */
const UPSTREAM_ROW_ERROR = /^(http 5\d\d|TimeoutError|AbortError)$/;

export type UpstreamStatus = { down: false } | { down: true; lastFreshAt: Date | null };

export async function getUpstreamStatus(db: Db, now: Date): Promise<UpstreamStatus> {
  const [latest] = await db
    .select({
      id: snapshots.id,
      status: snapshots.status,
      startedAt: snapshots.startedAt,
      error: snapshots.error,
    })
    .from(snapshots)
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(publicEvent)
    .orderBy(desc(snapshots.startedAt))
    .limit(1);
  if (!latest || now.getTime() - latest.startedAt.getTime() > UPSTREAM_DOWN_WINDOW_MS) {
    return { down: false };
  }
  if (!(await attemptFailedUpstream(db, latest, now))) return { down: false };
  const [fresh] = await db
    .select({ at: max(allianceSnapshots.sourceUpdatedAt) })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(and(publicEvent, eq(allianceSnapshots.isFresh, true), isNull(allianceSnapshots.error)));
  return { down: true, lastFreshAt: fresh?.at ?? null };
}

async function attemptFailedUpstream(
  db: Db,
  s: { id: number; status: string; startedAt: Date; error: string | null },
  now: Date,
): Promise<boolean> {
  // Never closed: the function was killed, which the 100 s deadline (D25) exists to prevent.
  if (s.status === "running") return now.getTime() - s.startedAt.getTime() > RUN_STALE_AFTER_MS;
  if (s.status === "complete") return false;
  if (s.error === "deadline") return true;
  const rows = await db
    .select({ error: allianceSnapshots.error })
    .from(allianceSnapshots)
    .where(eq(allianceSnapshots.snapshotId, s.id));
  const unanswered = rows.filter((r) => r.error !== null && UPSTREAM_ROW_ERROR.test(r.error));
  return rows.length > 0 && unanswered.length * 2 >= rows.length;
}
