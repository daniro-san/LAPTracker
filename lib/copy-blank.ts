// The blank dictionary for the ten-second test (plan Phase 5f). Moved out of lib/copy.ts, which re-exports
// both functions, to keep that file under the lint's line limit when the merge simulator's words came in.

/** Pseudo-localisation (plan Phase 5f): every character but spaces and `{placeholders}` becomes `░`. */
export function blankCopy<T>(value: T): T {
  if (typeof value === "string") {
    return value
      .split(/(\{\w+\})/)
      .map((part) => (/^\{\w+\}$/.test(part) ? part : part.replace(/\S/g, "░")))
      .join("") as T;
  }
  if (Array.isArray(value)) return value.map(blankCopy) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, blankCopy(v)])) as T;
  }
  return value;
}

/**
 * The game's own UI words (DESIGN.md "Numbers first"): members read Might, Kills, Members and Level in the
 * game every day, so the blank dictionary keeps them. A language uses the game's word for them where its
 * glossary sources one, else the English (D52).
 */
const GAME_TERMS = ["might", "kills", "members", "level"] as const;

/** Every value blanked except the game's own terms. */
export function blankDictionary<T extends { ledger: Record<(typeof GAME_TERMS)[number], string> }>(
  dictionary: T,
): T {
  const blank = blankCopy(dictionary);
  const kept = Object.fromEntries(GAME_TERMS.map((k) => [k, dictionary.ledger[k]]));
  return { ...blank, ledger: { ...blank.ledger, ...kept } };
}
