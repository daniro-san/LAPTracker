// The comparison form of a player name (D74, issue 297). Pure: no project imports. Two spellings of
// one name get one key: the sheets add decoration and a rank prefix, the OCR changes case and
// confuses Cyrillic and Latin letters, and the game itself allows look-alike letters.

/** Zero-width and filler characters that print as nothing. U+3164 is a Hangul filler some names end with; NFKC turns it into U+1160. */
const INVISIBLE = /[\u00AD\u1160\u200B-\u200F\u2060\uFEFF\u3164]/gu;

/**
 * Cyrillic and Greek letters that look like a Latin one (lower case), and the Latin letter each stands
 * for, position by position. Two strings, not an object keyed "x" and "y": lib/private/roster-fields.test.ts
 * reads a lone "x" or "y" literal as a roster coordinate.
 */
const LOOKALIKE_FROM = "авекмнорстухіјѕ" + "αεικνορτυχ";
const LOOKALIKE_TO = "abekmhopctyxijs" + "aeikvoptux";
const LOOKALIKE = new Map([...LOOKALIKE_FROM].map((c, i) => [c, LOOKALIKE_TO[i] as string]));

/** Characters that join two names in one (`Kasoar•Thorne`). */
const JOINER = /[•·∙|/\\]+/u;

/** Shortest segment that may stand for a whole name. */
const MIN_SEGMENT = 3;

const clean = (name: string) =>
  name.replace(INVISIBLE, "").normalize("NFKC").replace(INVISIBLE, "");

function fold(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\p{L}/gu, (c) => LOOKALIKE.get(c) ?? c);
}

/**
 * Case, accents, invisible characters, emoji, decoration, a leading `R1`..`R5 ` rank prefix and a
 * trailing `++` or `+-` are not part of the key; look-alike Cyrillic and Greek letters become Latin.
 * Empty when nothing but decoration is left.
 */
export function nameKey(name: string): string {
  return nameKeyOf(clean(name));
}

function nameKeyOf(cleaned: string): string {
  // `R4` is letters and a number, so only the prefix needs its own rule; a trailing `++` or `+-`
  // is symbols, which `fold` removes with every other decoration.
  const stripped = cleaned.trim().replace(/^R[1-5]\s+/i, "");
  return fold(stripped).replace(/\s+/g, "");
}

/** The keys of the parts of a joined name, in order; one key for a name without a joiner. */
export function nameSegments(name: string): string[] {
  const cleaned = clean(name);
  const parts = cleaned
    .split(JOINER)
    .map(nameKeyOf)
    .filter((key) => key !== "");
  return parts.length > 0 ? parts : [nameKeyOf(cleaned)].filter((key) => key !== "");
}

/** A segment is a usable stand-in for the name only when it is long enough to be specific. */
export function isNameSegment(key: string): boolean {
  return key.length >= MIN_SEGMENT;
}
