// Is the upstream answering? Derived only from rows we already store (docs/decisions/D27); never calls it.
// Reads the newest public snapshot and, for the "last fresh" time, the newest fresh alliance row.
import { and, desc, eq, isNull, max } from "drizzle-orm";

import { runAbandoned } from "../compute";
import type { Db } from "../db";
import { allianceSnapshots, events, snapshots } from "../schema";
import { phaseSnapshot, publicEvent } from "./visibility";

/** A failed attempt stops counting after this long; the page's own stale marks speak after that. */
export const UPSTREAM_DOWN_WINDOW_MS = 24 * 3_600_000;

/** Row errors the collector writes (lib/upstream-errors.ts `describe`) when the upstream does not answer. */
const UPSTREAM_ROW_ERROR = /^(http 5\d\d|TimeoutError|AbortError)$/;

export type UpstreamStatus = { down: false } | { down: true; lastFreshAt: Date | null };

/**
 * What the status is computed from, with no `now` in it, so it can be shared between requests (D143): the
 * newest public snapshot's start and state, whether its attempt failed upstream (null while it runs: that
 * depends on `now`), and the newest fresh alliance row's time, read only when the status can be down.
 */
export interface UpstreamRows {
  startedAt: Date;
  status: string;
  failed: boolean | null;
  lastFreshAt: Date | null;
}

export async function upstreamRows(db: Db): Promise<UpstreamRows | null> {
  const [latest] = await db
    .select({
      id: snapshots.id,
      status: snapshots.status,
      startedAt: snapshots.startedAt,
      error: snapshots.error,
    })
    .from(snapshots)
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(and(publicEvent, phaseSnapshot))
    .orderBy(desc(snapshots.startedAt))
    .limit(1);
  if (!latest) return null;
  const failed = latest.status === "running" ? null : await attemptFailedUpstream(db, latest);
  const base = { startedAt: latest.startedAt, status: latest.status, failed };
  if (failed === false) return { ...base, lastFreshAt: null };
  const [fresh] = await db
    .select({ at: max(allianceSnapshots.sourceUpdatedAt) })
    .from(allianceSnapshots)
    .innerJoin(snapshots, eq(snapshots.id, allianceSnapshots.snapshotId))
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(
      and(
        publicEvent,
        phaseSnapshot,
        eq(allianceSnapshots.isFresh, true),
        isNull(allianceSnapshots.error),
      ),
    );
  return { ...base, lastFreshAt: fresh?.at ?? null };
}

/** The status at `now`, from the rows: per request, so a cached row never freezes "down". */
export function upstreamStatusOf(rows: UpstreamRows | null, now: Date): UpstreamStatus {
  if (!rows || now.getTime() - rows.startedAt.getTime() > UPSTREAM_DOWN_WINDOW_MS) {
    return { down: false };
  }
  // Never closed: the function was killed, which the 100 s deadline (D25) exists to prevent.
  const failed = rows.failed ?? runAbandoned(rows, now);
  return failed ? { down: true, lastFreshAt: rows.lastFreshAt } : { down: false };
}

export async function getUpstreamStatus(db: Db, now: Date): Promise<UpstreamStatus> {
  return upstreamStatusOf(await upstreamRows(db), now);
}

async function attemptFailedUpstream(
  db: Db,
  s: { id: number; status: string; error: string | null },
): Promise<boolean> {
  if (s.status === "complete") return false;
  if (s.error === "deadline") return true;
  const rows = await db
    .select({ error: allianceSnapshots.error })
    .from(allianceSnapshots)
    .where(eq(allianceSnapshots.snapshotId, s.id));
  const unanswered = rows.filter((r) => r.error !== null && UPSTREAM_ROW_ERROR.test(r.error));
  return rows.length > 0 && unanswered.length * 2 >= rows.length;
}
