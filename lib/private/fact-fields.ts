// Member facts (issue #297, D80): the fields officers record about a member of their own alliance, where
// each value came from, and how two edits of one field made at the same time combine. Pure: the card's
// editor (a client component) imports it too.
import { dayIn } from "./calendar-time";

export const FACT_FIELDS = [
  "squadMight",
  "adTech",
  "troopTier",
  "timeZone",
  "languages",
  "status",
  "away",
  "notes",
] as const;
export type FactField = (typeof FACT_FIELDS)[number];

/** "from a message" (the paste box, confirmed), "typed by an officer", "from the sheet" (the import). */
export const FACT_SOURCES = ["message", "officer", "sheet"] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

/** Statuses an officer sets (D75); Fine and Check in stay computed. */
export const OFFICER_STATUSES = ["break", "help"] as const;
export type OfficerStatus = (typeof OFFICER_STATUSES)[number];

/**
 * An away note; `until` is the last server day away (YYYY-MM-DD), or null when nobody knows. `from` is the
 * first day away (issue 298); a note without it runs from the day it was written.
 */
export interface AwayNote {
  text: string;
  from?: string | null;
  until: string | null;
}

export interface FactValues {
  /** Main (first) squad might. */
  squadMight: number;
  /** Alliance Duel research, 0–100 %. */
  adTech: number;
  /** T1–T12, stored as the number. */
  troopTier: number;
  /** An IANA zone. */
  timeZone: string;
  /** Language codes, in LANGUAGES order. */
  languages: string[];
  status: OfficerStatus;
  away: AwayNote;
  notes: string;
}

/** A field's newest value (null: cleared), its source and its version (1 for the first write). */
export interface Fact<F extends FactField = FactField> {
  value: FactValues[F] | null;
  source: FactSource;
  version: number;
  /** When this version was written (ISO); a past day reads the facts as they were from then (D103). */
  at?: string;
}
export type MemberFacts = { [F in FactField]?: Fact<F> };

/** The languages offered, as codes (issue #297: EN, PT, FR, ES, DE, RU/UK, …). */
export const LANGUAGES = [
  "en",
  "pt",
  "fr",
  "es",
  "de",
  "it",
  "nl",
  "pl",
  "ru",
  "uk",
  "tr",
  "ar",
  "zh",
  "ja",
  "ko",
  "vi",
  "id",
  "fil",
] as const;

export const TIER_MAX = 12;

/** Fields whose concurrent edits are combined instead of refused (the owner's rule, issue #293). */
export const MERGED_FIELDS: readonly FactField[] = ["notes", "languages"];

const lines = (s: string | null) => (s ?? "").split("\n").filter((l) => l.trim() !== "");

/** Notes edited at once: the newer text, then each line the stale edit added that it does not hold. */
export function mergeNotes(base: string | null, mine: string, theirs: string | null): string {
  const known = new Set([...lines(base), ...lines(theirs)]);
  return [...lines(theirs), ...lines(mine).filter((l) => !known.has(l))].join("\n");
}

/** Languages edited at once: the newer list, without what the stale edit removed, with what it added. */
export function mergeLanguages(
  base: readonly string[] | null,
  mine: readonly string[],
  theirs: readonly string[] | null,
): string[] {
  const before = new Set(base ?? []);
  const removed = [...before].filter((l) => !mine.includes(l));
  const kept = new Set([...(theirs ?? []), ...mine.filter((l) => !before.has(l))]);
  for (const l of removed) kept.delete(l);
  return [...kept].sort((a, b) => rank(a) - rank(b));
}

const rank = (code: string) => {
  const i = (LANGUAGES as readonly string[]).indexOf(code);
  return i < 0 ? LANGUAGES.length : i;
};

/**
 * The last day of an away note that runs on server day `day` (YYYY-MM-DD): its first day, when it has one,
 * is not after `day`, and its last day is not before it. Null otherwise.
 */
export const awayUntil = (away: AwayNote | null | undefined, day: string): string | null =>
  away?.until && away.until >= day && (!away.from || away.from <= day) ? away.until : null;

/** The server day (SERVER_TZ `zone`) a fact version was written; null when not known. */
const savedDay = (fact: Pick<Fact, "at"> | undefined, zone: string) =>
  fact?.at ? dayIn(zone, Date.parse(fact.at)) : null;

/**
 * Whether a member is left out on server day `day` (roll calls, caravan suggestions): an away note that
 * runs that day, or On a break (an officer's status). Neither reaches into the past (D103): a note with
 * no first day runs from the day it was saved, and a break counts from the day it was set.
 * `until` is the note's last day, else null.
 */
export function awayOn(
  facts: Pick<MemberFacts, "status" | "away"> | undefined,
  day: string,
  zone: string,
): { until: string | null } | null {
  const until = noteUntil(facts?.away, day, zone);
  if (until !== null) return { until };
  return onBreak(facts?.status, day, zone) ? { until: null } : null;
}

/** The away note's last day when it runs on `day`; a note with no first day runs from its save. */
function noteUntil(away: Fact<"away"> | undefined, day: string, zone: string) {
  const note = away?.value;
  return note ? awayUntil({ ...note, from: note.from ?? savedDay(away, zone) }, day) : null;
}

/** An officer's On a break, from the day it was set. */
function onBreak(status: Fact<"status"> | undefined, day: string, zone: string) {
  const since = savedDay(status, zone);
  return status?.value === "break" && (since === null || since <= day);
}
