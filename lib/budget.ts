// Quota arithmetic (plan §3.4, §4). Pure: no IO, no clock.

/** The tracker's API calls a day for the site's key (plan §3.4); the UTC day resets it. */
export const DAILY_QUOTA = 1000;
/** `1,000`, as the /admin and guide strings write it. */
export const DAILY_QUOTA_TEXT = DAILY_QUOTA.toLocaleString("en");

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

/** The most alliance tags a KvK opponent has (D152): each is read once at the Start and once at the End. */
export const MAX_OPPONENT_TAGS = 15;

/**
 * Minimum `remaining` before a sample of `allianceCount` alliances (D69): the After's reserve
 * (`requiredQuota`) plus the sample's own worst case, its quota call and every read retried to the
 * limit (81 calls for 20). A sample that cannot leave the After its reserve is skipped, so the middle
 * samples always give way before the After could be starved. `opponentReads`: the KvK opponent's End reads
 * still due (D152), counted in the After's reserve; samples never read the opponent.
 * INVARIANT budget.samples-yield-to-after
 */
export function sampleQuota(allianceCount: number, opponentReads = 0): number {
  return requiredQuota(allianceCount + opponentReads) + 1 + ATTEMPTS_PER_READ * allianceCount;
}

/**
 * Minimum `remaining` before a daily read of `alliances` rosters (D60): its own reserve plus a whole
 * event run's, so a daily read never takes the quota a scheduled event needs that UTC day.
 * INVARIANT budget.daily-keeps-event-reserve
 */
export function dailyReadQuota(alliances: number, eventAlliances: number): number {
  return requiredQuota(alliances) + requiredQuota(eventAlliances);
}
