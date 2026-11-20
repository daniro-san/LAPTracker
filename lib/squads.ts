// The squads read's rules (D117), pure: no IO, `now` passed in. The quota it must leave, which squad is
// the main one, and when the tracker's main squad becomes a new version of "Main squad might".
import { requiredQuota } from "./budget";
import { RUN_DEADLINE_MS } from "./compute";
import type { Env } from "./env";
import {
  dailyReadDue,
  endsInServerDay,
  inEventWindow,
  nextEvent,
  quotaDayRead,
  type ScheduleConfig,
} from "./schedule";

/** Calls the squads read always leaves on its quota day, for an /admin Retry, a rehearsal and slack. */
export const SQUADS_SAFETY_MARGIN = 100;

/** The most /v1/players calls one day's squads read makes, whatever the roster says. */
export const SQUAD_CALLS_MAX = 120;

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
 * The day an /admin press reads outside the nightly window (D117, amendment 2026-11-19b), or why not now.
 * It is the read of `now`'s quota day (`quotaDayRead`), so a press and the nightly batches share one row:
 * its cursor, its retry list and its cap. Never during the scheduled event's Before/After window, and only
 * when a batch of `runMs` ends before the next quota reset (00:00 UTC), so every call lands on that day.
 */
export function forcedSquadsDay(
  now: Date,
  cfg: ScheduleConfig,
  runMs: number,
): { day: string } | { refused: "event_window" | "quota_reset" } {
  if (inEventWindow(now, cfg)) return { refused: "event_window" };
  const reset = Date.parse(`${utcDate(now)}T00:00:00Z`) + 86_400_000;
  if (now.getTime() + runMs > reset) return { refused: "quota_reset" };
  return { day: quotaDayRead(now, cfg) };
}

/** The day a squads batch reads at `now`, or null: the nightly window's, or for a press the quota day's. */
export function squadsBatchDay(now: Date, cfg: ScheduleConfig, force: boolean): string | null {
  if (force) {
    const forced = forcedSquadsDay(now, cfg, RUN_DEADLINE_MS);
    return "day" in forced ? forced.day : null;
  }
  const due = dailyReadDue(now, cfg);
  // INVARIANT daily-read.ends-before-midnight, for the squads too: a batch ends before 00:00.
  return due && endsInServerDay(now, RUN_DEADLINE_MS, cfg) ? due.day : null;
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
