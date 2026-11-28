// The alliance's glossary words, protected for a request (#832, D81 amendment): each occurrence is replaced by
// a placeholder {G1}, {G2}, … before the model sees the text and put back, as written, after it answers. An
// answer that lost one of the placeholders issued is not trusted. A {G<n>} already written in the text is
// swapped for another token first, so it is never taken for a placeholder and comes back as it was. Imports
// nothing from the project (D71).

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");

export interface Protected {
  text: string;
  /** Each protected piece as it was written, in order: piece n is {Gn}. */
  kept: string[];
  /** Each {G<n>} the text already had, in order: literal n is {<tag>n}. */
  literals: string[];
  /** The letter of the swapped tokens, one that no token of the text already uses. */
  tag: string;
}

/** A letter X (not G) such that the text has no {X<digits>}. */
const freeTag = (text: string) =>
  [..."LQXZKJ"].find((tag) => !new RegExp(`\\{${tag}\\d+\\}`).test(text)) ?? "L";

/** The text with every glossary word (any case, whole words only) replaced by its placeholder. */
export function protectWords(text: string, words: readonly string[]): Protected {
  const kept: string[] = [];
  const literals: string[] = [];
  if (words.length === 0) return { text, kept, literals, tag: "L" };
  const tag = freeTag(text);
  const neutral = text.replace(/\{G\d+\}/g, (found) => `{${tag}${literals.push(found)}}`);
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${[...words]
      .sort((a, b) => b.length - a.length)
      .map(escape)
      .join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );
  return {
    text: neutral.replace(pattern, (found) => `{G${kept.push(found)}}`),
    kept,
    literals,
    tag,
  };
}

/** Whether the answer still has every placeholder and swapped token issued; any other token is left alone. */
export function placeholdersIntact(answer: string, p: Protected): boolean {
  const has = (token: string) => answer.includes(token);
  return (
    p.kept.every((_, i) => has(`{G${i + 1}}`)) &&
    p.literals.every((_, i) => has(`{${p.tag}${i + 1}}`))
  );
}

/** Puts the pieces back in place of their placeholders, then the swapped tokens as they were written. */
export function restoreWords(answer: string, p: Protected): string {
  const pieces = answer.replace(
    /\{G(\d+)\}/g,
    (found, n: string) => p.kept[Number(n) - 1] ?? found,
  );
  return pieces.replace(
    new RegExp(`\\{${p.tag}(\\d+)\\}`, "g"),
    (found, n: string) => p.literals[Number(n) - 1] ?? found,
  );
}
