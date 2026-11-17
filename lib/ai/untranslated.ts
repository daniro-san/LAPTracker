// Did a translation come back mostly untranslated (D81)? At reasoning_effort "low", gpt-oss-120b sometimes
// returns a terse list notice with most lines still in English. Each line is reduced to the words that
// should change: [TAG]Name tags, numbers, times, emoji, punctuation, one-letter words, the do-not-translate
// terms and the terms' own names are taken out. A source line counts as untranslated when an answer line
// still holds most of its words; the answer is untranslated when that is true of enough source lines.
import { DO_NOT_TRANSLATE, TRANSLATED_TERMS } from "./glossary";

/**
 * A source line still this much present in some answer line counts as untranslated. Half, because a
 * terse line ("Wed | RESEARCH: tech speedups") can come back with its weekday and heading translated and
 * its words left in English (11i, a real run that 0.6 let through).
 */
const LINE_OVERLAP = 0.5;
/** Below this many words a line is too short for an overlap ("Rally às 18:00"): only an unchanged line counts. */
const SHORT_LINE = 3;
/** This share of the source lines untranslated makes the answer untranslated. */
export const UNTRANSLATED_SHARE = 0.4;

const escape = (term: string) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");

/** Kept as written in every language, so never a sign of a missing translation. */
const KEPT = new RegExp(
  `(?<![\\p{L}\\d])(${[
    ...DO_NOT_TRANSLATE,
    ...Object.entries(TRANSLATED_TERMS).flatMap(([term, names]) => [term, ...Object.values(names)]),
  ]
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join("|")})(?![\\p{L}\\d])`,
  "giu",
);

/** The words of a line that a translation should change, lower case. */
export function wordsToTranslate(line: string): Set<string> {
  const rest = line
    .replace(/\[[^\]]*\]\S*/gu, " ")
    .replace(KEPT, " ")
    .replace(/[^\p{L}]+/gu, " ")
    .toLowerCase();
  return new Set(rest.split(" ").filter((w) => w.length > 1));
}

/** The share (0–1) of the source's lines that come back with most of their words unchanged. */
export function untranslatedShare(source: string, answer: string): number {
  const sourceLines = source
    .split("\n")
    .map(wordsToTranslate)
    .filter((w) => w.size > 0);
  if (sourceLines.length === 0) return 0;
  const answerLines = answer.split("\n").map(wordsToTranslate);
  const left = sourceLines.filter((words) => {
    const needed = words.size < SHORT_LINE ? 1 : LINE_OVERLAP;
    return answerLines.some(
      (other) => [...words].filter((w) => other.has(w)).length / words.size >= needed,
    );
  });
  return left.length / sourceLines.length;
}

export const mostlyUntranslated = (source: string, answer: string): boolean =>
  untranslatedShare(source, answer) >= UNTRANSLATED_SHARE;
