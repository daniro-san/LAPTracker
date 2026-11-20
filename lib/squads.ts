// The squads read's rules (D117, D132), pure: no IO, `now` passed in. The quota it must leave, the day's
// queue and its batches, which squad is the main one, and when the tracker's main squad becomes a new
// version of "Main squad might".
import { requiredQuota } from "./budget";
import type { Env } from "./env";
import { inEventWindow, nextEvent, quotaDayRead, type ScheduleConfig } from "./schedule";

/** Calls the squads read always leaves on its quota day, for an /admin Retry, a rehearsal and slack. */
export const SQUADS_SAFETY_MARGIN = 100;

/** The most /v1/players calls one day's squads read makes, whatever the roster says. */
export const SQUAD_CALLS_MAX = 120;

/** D132: the most calls one batch makes (about 25 at the current pace of about 1.5 s a call). */
export const SQUADS_BATCH_CALLS = 25;

/** D132: one batch's deadline, counted from before its claim: well inside the tick's maxDuration. */
export const SQUADS_BATCH_MS = 60_000;

/** D132: a member is called at most this many times in a quota day (a 5xx or no answer is tried again). */
export const SQUADS_ATTEMPTS_MAX = 3;

/** D132: a member whose call failed goes to the back of the queue, no sooner than a later tick. */
export const SQUADS_RETRY_AFTER_MS = 15 * 60_000;

export type SquadsConfig = ScheduleConfig & Pick<Env, "SAMPLE_EVERY_MIN">;

const utcDate = (at: Date) => at.toISOString().slice(0, 10);

/**
 * The calls the scheduled event still needs on `now`'s quota day (a UTC day): its Before and After with
 * their reserve, and one quota call plus one read per alliance for every sample between them (D69). Zero
 * when the event does not fall on that UTC day or is over. The read of Friday 23:37 server time is
 * Saturday 01:37 UTC, so it spends from the KvK's own quota day.
 */
export function eventReserve(now: Date, cfg: SquadsConfig, alliances: number): number {
  const event = nextEvent(now, cfg);
  if (event.afterAt <= now) return 0;
  const day = utcDate(now);
  if (utcDate(event.beforeAt) !== day && utcDate(event.afterAt) !== day) return 0;
  const every = cfg.SAMPLE_EVERY_MIN * 60_000;
  const span = event.afterAt.getTime() - event.beforeAt.getTime();
  const samples = every > 0 ? Math.max(0, Math.ceil(span / every) - 1) : 0;
  return requiredQuota(alliances) + samples * (alliances + 1);
}

/**
 * What must remain after the squads read (INVARIANT squads.keeps-event-reserve): the safety margin, plus
 * the event's reads when the event falls on the same quota day.
 */
export const squadsReserve = (now: Date, cfg: SquadsConfig, alliances: number): number =>
  SQUADS_SAFETY_MARGIN + eventReserve(now, cfg, alliances);

/**
 * The day whose queue a batch reads at `now` (D132): the daily read of `now`'s quota day (`quotaDayRead`),
 * so the tick, a press and the backup route share one row, one queue and one cap. Null when a batch would
 * end after the next quota reset (00:00 UTC): every call lands on the day it is counted under.
 */
export function squadsQueueDay(now: Date, cfg: ScheduleConfig): string | null {
  const reset = Date.parse(`${utcDate(now)}T00:00:00Z`) + 86_400_000;
  return now.getTime() + SQUADS_BATCH_MS > reset ? null : quotaDayRead(now, cfg);
}

/**
 * The day an /admin press reads (D117, amendment 2026-11-19b; D132), or why not now: the queue's day, never
 * during the scheduled event's Before/After window.
 */
export function forcedSquadsDay(
  now: Date,
  cfg: ScheduleConfig,
): { day: string } | { refused: "event_window" | "quota_reset" } {
  if (inEventWindow(now, cfg)) return { refused: "event_window" };
  const day = squadsQueueDay(now, cfg);
  return day ? { day } : { refused: "quota_reset" };
}

/**
 * Why a stopped or skipped day reads nobody more today, in the words /admin and Settings use (D132): the
 * tracker refused the key, the quota is spent until 00:00 UTC, or the day's 120 calls are used. Null for
 * any other reason (shown as its code on /admin).
 */
export function stopKind(reason: string | null): "key" | "limit" | "cap" | null {
  if (reason === "key_invalid" || reason === "key_forbidden") return "key";
  if (reason === "quota_429" || reason === "key_out_of_quota") return "limit";
  return reason === "cap" ? "cap" : null;
}

/**
 * What becomes of a member whose call failed (D132): a 5xx, no answer or a call the deadline cut goes to
 * the back of the queue, until its third attempt; anything else is not tried again that day.
 */
export function afterFailure(
  attempts: number,
  retryable: boolean,
  now: Date,
): { state: "waiting" | "failed"; attempts: number; dueAt: Date } {
  const tried = attempts + 1;
  const again = retryable && tried < SQUADS_ATTEMPTS_MAX;
  const dueAt = again ? new Date(now.getTime() + SQUADS_RETRY_AFTER_MS) : now;
  return { state: again ? "waiting" : "failed", attempts: tried, dueAt };
}

export interface SquadSeen {
  squad: number;
  power: number;
  seenAt: Date | null;
  readAt: Date;
}

/** The main squad: the strongest stored squad (each number's newest row); a tie goes to the lower number. */
export function mainSquad<S extends SquadSeen>(squads: readonly S[]): S | null {
  let best: S | null = null;
  for (const s of squads)
    if (!best || s.power > best.power || (s.power === best.power && s.squad < best.squad)) best = s;
  return best;
}

/** The newest stored "Main squad might" version: its value, who wrote it, when. */
export interface MightVersion {
  value: unknown;
  source: string;
  writtenAt: Date;
}

/**
 * Whether the tracker's main squad becomes the next version (INVARIANT squads.officer-value-kept). Never
 * when the value is the same. Over a tracker value, whenever it differs. Over an officer's, a message's
 * or the sheet's value (or a clear), only when the tracker saw the squad after that value was saved: a
 * value typed after the sighting stays until the tracker sees the squad again.
 */
export function trackerMightWrite(newest: MightVersion | null, main: SquadSeen): boolean {
  if (!newest) return true;
  if (newest.value === main.power) return false;
  if (newest.source === "tracker") return true;
  return (main.seenAt ?? main.readAt).getTime() > newest.writtenAt.getTime();
}
