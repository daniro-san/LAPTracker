// The alliance's glossary words, protected for a request (#832, D81 amendment): each occurrence is replaced by
// a placeholder {G1}, {G2}, … before the model sees the text and put back, as written, after it answers. An
// answer that lost a placeholder is not trusted. Imports nothing from the project (D71).

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");

export interface Protected {
  text: string;
  /** Each protected piece as it was written, in order: piece n is {Gn}. */
  kept: string[];
}

/** The text with every glossary word (any case, whole words only) replaced by its placeholder. */
export function protectWords(text: string, words: readonly string[]): Protected {
  const kept: string[] = [];
  if (words.length === 0) return { text, kept };
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${[...words]
      .sort((a, b) => b.length - a.length)
      .map(escape)
      .join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  return { text: text.replace(pattern, (found) => `{G${kept.push(found)}}`), kept };
}

/** Whether every placeholder of `kept` is in the answer and the answer has no other. */
export function placeholdersIntact(answer: string, kept: readonly string[]): boolean {
  const found = new Set(Array.from(answer.matchAll(/\{G(\d+)\}/g), (m) => Number(m[1])));
  return found.size === kept.length && kept.every((_, i) => found.has(i + 1));
}

/** Puts the pieces back in place of their placeholders. */
export const restoreWords = (answer: string, kept: readonly string[]): string =>
  answer.replace(/\{G(\d+)\}/g, (found, n: string) => kept[Number(n) - 1] ?? found);
