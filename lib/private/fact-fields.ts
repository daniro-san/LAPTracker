// Member facts (issue #297, D80): the fields officers record about a member of their own alliance, where
// each value came from, and how two edits of one field made at the same time combine. Pure: the card's
// editor (a client component) imports it too.
import type { AwayNote } from "../member-away";

// Who is away on a day is shared with the tick's Raid prep fill (D137): lib/member-away.ts.
export { awayNoteUntil, awayOn, awayUntil, type AwayNote } from "../member-away";

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

/** "from a message" (the paste box, confirmed), "typed by an officer", "from the sheet" (the import),
 * "from the tracker" (Main squad might from the nightly squads read, D117; never typed in the editor),
 * "from the member" (what the member sent about themselves, put on the card by an officer, D154). */
export const FACT_SOURCES = ["message", "officer", "sheet", "tracker", "member"] as const;
export type FactSource = (typeof FACT_SOURCES)[number];

/** Statuses an officer sets (D75); Fine and Check in stay computed. */
export const OFFICER_STATUSES = ["break", "help"] as const;
export type OfficerStatus = (typeof OFFICER_STATUSES)[number];

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
/**
 * Why a former member left (issue 469, D107 amendment 2026-11-27): one of these, in neutral words (D75),
 * with an optional note. Stored as the member fact `leftReason`, outside FACT_FIELDS: only a former member
 * gets one, from the Former members view, never from the facts editor.
 */
export const LEFT_REASONS = ["left", "otherAlliance", "removed", "inactive", "unknown"] as const;
export type LeftReasonCode = (typeof LEFT_REASONS)[number];
export const LEFT_FIELD = "leftReason";
export const LEFT_NOTE_MAX = 500;
export interface LeftReason {
  reason: LeftReasonCode;
  note: string;
}

/**
 * A member's buddy (issue 828, D140 amendment 2026-11-28): the uid of a current member of the alliance an
 * officer named to say hello. Stored as the member fact `buddy`, outside FACT_FIELDS, like `leftReason`:
 * the facts editor never offers it, the member card has its own block. A null value clears it.
 */
export const BUDDY_FIELD = "buddy";

export type MemberFacts = { [F in FactField]?: Fact<F> } & {
  buddy?: Omit<Fact, "value"> & { value: number | null };
  leftReason?: Omit<Fact, "value"> & { value: LeftReason | null };
  /** The member's own away days (issue 829), laid over by `factsOf`; not a fact, never in member_facts. */
  ownAway?: { value: AwayNote | null; at?: string };
};

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

/**
 * AD Tech at this value is complete (D109): shown as done, never asked again, and not written again by
 * chat or Paste updates drafts. The facts editor stays free to correct it.
 */
export const AD_COMPLETE = 100;

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
