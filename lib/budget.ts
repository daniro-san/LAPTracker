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

/** Retries after a 502/503/504 (lib/sources/v1.ts reads it from here, so the sample's worst case follows). */
export const MAX_RETRIES = 3;

/** A read's attempts at most: the first call and its retries. */
const ATTEMPTS_PER_READ = MAX_RETRIES + 1;

/**
 * Minimum `remaining` before a sample of `allianceCount` alliances (D69): the After's reserve
 * (`requiredQuota`) plus the sample's own worst case, its quota call and every read retried to the
 * limit (81 calls for 20). A sample that cannot leave the After its reserve is skipped, so the middle
 * samples always give way before the After could be starved.
 * INVARIANT budget.samples-yield-to-after
 */
export function sampleQuota(allianceCount: number): number {
  return requiredQuota(allianceCount) + 1 + ATTEMPTS_PER_READ * allianceCount;
}

/**
 * Minimum `remaining` before a daily read of `alliances` rosters (D60): its own reserve plus a whole
 * event run's, so a daily read never takes the quota a scheduled event needs that UTC day.
 * INVARIANT budget.daily-keeps-event-reserve
 */
export function dailyReadQuota(alliances: number, eventAlliances: number): number {
  return requiredQuota(alliances) + requiredQuota(eventAlliances);
}
