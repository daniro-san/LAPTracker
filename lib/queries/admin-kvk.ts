// /admin's KvK opponent card (D152): the next scheduled event and the 4 before it, each with its opponent,
// what the Start and End read of each tag, and its server's ranks board suggestion (D155). Admin only: the
// result, the error rows and the suggestion stay here.
import type { Db } from "../db";
import {
  kvkEventTimes,
  opponentReads,
  opponentsAt,
  SUGGEST_MAX_ATTEMPTS,
  SUGGEST_STALE_AFTER_MS,
  suggestionsAt,
} from "../repo/kvk";

/** Whether "Suggest tags" may read the board: no read yet, or a failed (or stale) one with attempts left. */
const canRetry = (
  s: { status: string; attempts: number; claimedAt: Date } | undefined,
  now: Date,
) =>
  !s ||
  (s.attempts < SUGGEST_MAX_ATTEMPTS &&
    (s.status === "failed" ||
      (s.status === "running" && now.getTime() - s.claimedAt.getTime() > SUGGEST_STALE_AFTER_MS)));

export async function adminKvk(db: Db, next: Date, now: Date) {
  const times = await kvkEventTimes(db, next);
  const [opponents, suggestions] = await Promise.all([
    opponentsAt(db, times),
    suggestionsAt(db, times),
  ]);
  const reads = await opponentReads(
    db,
    opponents.map((o) => o.id),
  );
  return times.map((at) => {
    const opponent = opponents.find((o) => o.eventAt.getTime() === at.getTime()) ?? null;
    const suggestion = suggestions.find(
      (s) => s.eventAt.getTime() === at.getTime() && s.server === opponent?.server,
    );
    const own = reads.filter((r) => r.opponentId === opponent?.id);
    return {
      at,
      opponent,
      reads: own,
      suggestion: suggestion ?? null,
      // Before the war only, and nothing once the Start read a tag (D155).
      canSuggest: opponent !== null && now < at && own.length === 0 && canRetry(suggestion, now),
    };
  });
}

export type AdminKvkRead = Awaited<ReturnType<typeof adminKvk>>[number]["reads"][number];
