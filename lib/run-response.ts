// The HTTP shape of a RunOutcome, shared by /api/tick and /api/snapshot.
import type { RunOutcome } from "./run";

export function runResponse(outcome: RunOutcome): Response {
  if (!outcome.ok) {
    return Response.json(
      {
        code: outcome.code,
        snapshot_id: outcome.snapshotId,
        ...(outcome.staleCount !== undefined && { stale_count: outcome.staleCount }),
      },
      { status: outcome.status },
    );
  }
  const s = outcome.summary;
  return Response.json({
    snapshot_id: s.snapshotId,
    phase: s.phase,
    status: s.status,
    calls_used: s.callsUsed,
    quota_remaining_after: s.quotaRemainingAfter,
    duration_ms: s.durationMs,
    stale: s.stale.map((a) => a.tag ?? a.unionId),
    failed: s.failed.map((a) => a.tag ?? a.unionId),
  });
}
