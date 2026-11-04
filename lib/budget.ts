// Quota arithmetic (plan §3.4, §4). Pure: no IO, no clock.

/** Margin per run: the quota check itself, the Friday check, and retries. */
const RESERVE_CALLS = 5;

/**
 * Minimum `remaining` quota before a run may start: enough for this run and the other phase.
 * INVARIANT budget.reserve-for-after — a BEFORE run never leaves too little for the AFTER run.
 */
export function requiredQuota(allianceCount: number): number {
  return 2 * (allianceCount + RESERVE_CALLS);
}
