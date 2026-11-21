// Who is away on a server day (D103), pure and browser-safe: an away note that runs that day, or an
// officer's On a break. Outside lib/private so the tick's Raid prep fill (D137) leaves away members out as
// the roll call does; lib/private/fact-fields.ts re-exports it with the member facts it reads.
import { dayIn } from "./calendar-time";

/**
 * An away note; `until` is the last server day away (YYYY-MM-DD), or null when nobody knows. `from` is the
 * first day away (issue 298); a note without it runs from the day it was written.
 */
export interface AwayNote {
  text: string;
  from?: string | null;
  until: string | null;
}

/** The two facts the rule reads, each its newest value and when that version was written (ISO). */
export interface AwayFacts {
  status?: { value: string | null; at?: string } | undefined;
  away?: { value: AwayNote | null; at?: string } | undefined;
}

/**
 * The last day of an away note that runs on server day `day` (YYYY-MM-DD): its first day, when it has one,
 * is not after `day`, and its last day is not before it. Null otherwise.
 */
export const awayUntil = (away: AwayNote | null | undefined, day: string): string | null =>
  away?.until && away.until >= day && (!away.from || away.from <= day) ? away.until : null;

/** The server day (SERVER_TZ `zone`) a fact version was written; null when not known. */
const savedDay = (fact: { at?: string } | undefined, zone: string) =>
  fact?.at ? dayIn(zone, Date.parse(fact.at)) : null;

/**
 * Whether a member is left out on server day `day` (roll calls, caravan suggestions): an away note that
 * runs that day, or On a break (an officer's status). Neither reaches into the past (D103): a note with
 * no first day runs from the day it was saved, and a break counts from the day it was set.
 * `until` is the note's last day, else null.
 */
export function awayOn(
  facts: AwayFacts | undefined,
  day: string,
  zone: string,
): { until: string | null } | null {
  const until = noteUntil(facts?.away, day, zone);
  if (until !== null) return { until };
  return onBreak(facts?.status, day, zone) ? { until: null } : null;
}

/** The away note's last day when it runs on `day`; a note with no first day runs from its save. */
function noteUntil(away: AwayFacts["away"], day: string, zone: string) {
  const note = away?.value;
  return note ? awayUntil({ ...note, from: note.from ?? savedDay(away, zone) }, day) : null;
}

/** An officer's On a break, from the day it was set. */
function onBreak(status: AwayFacts["status"], day: string, zone: string) {
  const since = savedDay(status, zone);
  return status?.value === "break" && (since === null || since <= day);
}
