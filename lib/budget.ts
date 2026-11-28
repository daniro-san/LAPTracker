// Quota arithmetic (plan §3.4, §4). Pure: no IO, no clock.

/** The tracker's API calls a day for the site's key (plan §3.4); the UTC day resets it. */
export const DAILY_QUOTA = 1000;
/** `1,000`, as the /admin and guide strings write it. */
export const DAILY_QUOTA_TEXT = DAILY_QUOTA.toLocaleString("en");

/** Margin per run: the quota check itself, the Friday check, and retries. */
const RESERVE_CALLS = 5;

/** One full read's reserve: its alliances plus RESERVE_CALLS. */
const readReserve = (allianceCount: number) => allianceCount + RESERVE_CALLS;

/**
 * Minimum `remaining` quota before a run may start: enough for this run and the other phase, plus
 * `laterReads` full reads of the event's later windows still due that UTC day (D160, `laterWindowReads`).
 * INVARIANT budget.reserve-for-after — a BEFORE run never leaves too little for the AFTER run.
 * INVARIANT budget.reserve-for-later-windows — no read of a window starves a later window's Before or After
 * on the same quota day.
 */
export function requiredQuota(allianceCount: number, laterReads = 0): number {
  return (2 + laterReads) * readReserve(allianceCount);
}

/**
 * The Befores and Afters of an event's other windows still due after `now` on its UTC day (D160), which a
 * read of window `current` leaves quota for. A one-window event has none. The current window's After is
 * already in `requiredQuota`.
 */
export function laterWindowReads(
  windows: readonly { n: number; beforeAt: Date; afterAt: Date }[],
  current: number,
  now: Date,
): number {
  const day = now.toISOString().slice(0, 10);
  const due = (at: Date) => at > now && at.toISOString().slice(0, 10) === day;
  return windows
    .filter((w) => w.n !== current)
    .reduce((n, w) => n + Number(due(w.beforeAt)) + Number(due(w.afterAt)), 0);
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
 * still due (D152), counted in the After's reserve; samples never read the opponent. `laterReads`: the
 * later windows' Befores and Afters still due that UTC day (D160), reserved as well.
 * INVARIANT budget.samples-yield-to-after
 */
export function sampleQuota(allianceCount: number, opponentReads = 0, laterReads = 0): number {
  return (
    requiredQuota(allianceCount + opponentReads) +
    laterReads * readReserve(allianceCount) +
    1 +
    ATTEMPTS_PER_READ * allianceCount
  );
}

/**
 * Minimum `remaining` before a daily read of `alliances` rosters (D60): its own reserve plus a whole
 * event run's, so a daily read never takes the quota a scheduled event needs that UTC day; `opponentCalls`:
 * the KvK opponent's calls still due on that day (D152, `opponentReserve`); `eventReads`: the event
 * windows' Befores and Afters still due on that day (D160, `eventReadsDueToday`), of which a one-window
 * event's two are always reserved.
 * INVARIANT budget.daily-keeps-event-reserve
 */
export function dailyReadQuota(
  alliances: number,
  eventAlliances: number,
  opponentCalls = 0,
  eventReads = 2,
): number {
  const laterReads = Math.max(0, eventReads - 2);
  return requiredQuota(alliances) + requiredQuota(eventAlliances, laterReads) + opponentCalls;
}
