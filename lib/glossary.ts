// An alliance's glossary words (#832): the rules for one word and for the list, shared by the desk's card and
// the route that saves it, so both agree. No imports: the card is a client component.

export const GLOSSARY_MAX_WORDS = 100;
export const GLOSSARY_MAX_CHARS = 40;

/** One word as stored: spaces trimmed and collapsed; null when empty, too long, or holding braces or controls. */
export function cleanWord(raw: string): string | null {
  const word = raw.trim().replace(/\s+/gu, " ");
  if (word === "" || Array.from(word).length > GLOSSARY_MAX_CHARS) return null;
  return /[{}\p{C}]/u.test(word) ? null : word;
}

/** The list as stored: each word cleaned, repeats (any case) dropped; null when a word is not valid. */
export function cleanWords(raw: readonly string[]): string[] | null {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const entry of raw) {
    const word = cleanWord(entry);
    if (word === null) return null;
    const key = word.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      words.push(word);
    }
  }
  return words;
}

/**
 * The list after Undo of a removal: the words now saved plus the removed one, which goes to the end; the
 * list is not put back as it was, so a word added since stays. Unchanged when the word is back already
 * (any case) or the list is full.
 */
export function undoList(current: readonly string[], removed: string): string[] {
  const back = current.some((w) => w.toLocaleLowerCase() === removed.toLocaleLowerCase());
  return back || current.length >= GLOSSARY_MAX_WORDS ? [...current] : [...current, removed];
}
