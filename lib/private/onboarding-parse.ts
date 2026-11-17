// "Paste what they told you" (issue #297, D80): the facts a new member gives the recruiter in chat (main
// squad might, Alliance Duel research %, time zone, languages), read from pasted text or from the OCR
// lines of a chat picture. Pure; every value it finds is only a proposal "from a message", which an
// officer confirms or edits before anything is saved. The shapes were measured on real chats (issue #297).
//
// The game's auto-translation shows a message twice, the original and then English, and the OCR can
// misread one of the two ("47%" as "479"). So a number is taken when it carries its unit (%, M, K) or
// when every line that has one agrees.
import { LANGUAGES } from "./fact-fields";
import { fold } from "./members-list";
import { cellNumber } from "./sheet-parse";
import { abbreviation, zonesNamed } from "./time-zones";

export interface OnboardingFacts {
  squadMight: number | null;
  /** Alliance Duel research, 0–100. */
  adTech: number | null;
  /** IANA zones the text names, best first; empty when it names none. */
  timeZones: string[];
  /** Language codes named in the text, in LANGUAGES order. */
  languages: string[];
}

interface Reading {
  value: number;
  unit: boolean;
}

const MILLION = /^(m|mi|mm|mln|kk|million|millions|milhao|milhoes)$/;
const THOUSAND = /^(k|mil)$/;
const BILLION = /^(b|bi|billion|billions)$/;
/** 7,215,408 · 4.830.112 · 6481293 · 12.3 M · 12,3M · 12300k · 11.4M; never part of a word or a time. */
const AMOUNT =
  /(?<![\p{L}\d.,])(\d{1,3}(?:[.,\s]\d{3})+|\d+(?:[.,]\d+)?)\s*(kk|k|mil|mi|mm|mln|millions?|milh(?:ão|ões|ao|oes)|m|bi|b|billions?)?(?![\p{L}\d])/giu;
const PERCENT = /(\d{1,3}(?:[.,]\d+)?)\s*%/g;
/** 2.04 pm, 14:05: a clock, not an amount. */
const CLOCK = /\b\d{1,2}(?::\d{2}(?:\s*[ap]m)?|[.h]\d{2}\s*[ap]m)\b/gi;

const AD_WORDS = new Set([
  "ad",
  "duel",
  "duelo",
  "duell",
  "research",
  "pesquisa",
  "recherche",
  "investigacion",
  "tech",
  "tecnologia",
  "technologie",
]);
const MIGHT_WORDS = new Set([
  "squad",
  "squadron",
  "esquadrao",
  "esquadra",
  "equipe",
  "escouade",
  "escuadron",
  "power",
  "poder",
  "puissance",
  "might",
]);
const ZONE_WORDS = [
  "time zone",
  "timezone",
  "tz",
  "fuso",
  "fuseau",
  "horario",
  "huso",
  "zona horaria",
];
const PREFIXED_OFFSET = /\b(st|utc|gmt)\s*[+\-−]\s*\d/i;

const LANGUAGE_WORDS = new Map(
  Object.entries({
    english: "en",
    inglês: "en",
    anglais: "en",
    portuguese: "pt",
    português: "pt",
    portugais: "pt",
    french: "fr",
    francês: "fr",
    français: "fr",
    spanish: "es",
    español: "es",
    espanhol: "es",
    espagnol: "es",
    german: "de",
    deutsch: "de",
    alemão: "de",
    allemand: "de",
    italian: "it",
    italiano: "it",
    italien: "it",
    dutch: "nl",
    nederlands: "nl",
    holandês: "nl",
    néerlandais: "nl",
    polish: "pl",
    polski: "pl",
    polonês: "pl",
    polonais: "pl",
    russian: "ru",
    russo: "ru",
    russe: "ru",
    русский: "ru",
    ukrainian: "uk",
    ucraniano: "uk",
    ukrainien: "uk",
    українська: "uk",
    turkish: "tr",
    turco: "tr",
    turc: "tr",
    arabic: "ar",
    árabe: "ar",
    arabe: "ar",
    chinese: "zh",
    chinês: "zh",
    chinois: "zh",
    japanese: "ja",
    japonês: "ja",
    japonais: "ja",
    korean: "ko",
    coreano: "ko",
    coréen: "ko",
    vietnamese: "vi",
    vietnamita: "vi",
    vietnamien: "vi",
    indonesian: "id",
    indonésio: "id",
    indonésien: "id",
    filipino: "fil",
    tagalog: "fil",
  }).map(([word, code]) => [fold(word), code]),
);

const wordsOf = (line: string) =>
  fold(line)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

function amountOf(digits: string, unit: string | undefined): number {
  const grouped = /^\d{1,3}(?:[.,\s]\d{3})+$/.test(digits);
  const n = grouped ? Number(digits.replace(/[.,\s]/g, "")) : Number(digits.replace(",", "."));
  const u = fold(unit ?? "");
  const times = MILLION.test(u) ? 1e6 : THOUSAND.test(u) ? 1e3 : BILLION.test(u) ? 1e9 : 1;
  return Math.round(n * times);
}

/** The squad might and AD % one line holds. */
function readLine(line: string): { might: Reading[]; ad: Reading[] } {
  const words = new Set(wordsOf(line));
  const isAd = [...words].some((w) => AD_WORDS.has(w));
  const isMight = [...words].some((w) => MIGHT_WORDS.has(w));
  const ad: Reading[] = [];
  for (const m of line.matchAll(PERCENT)) {
    const value = Number((m[1] as string).replace(",", "."));
    if (value <= 100) ad.push({ value: Math.round(value * 10) / 10, unit: true });
  }
  const rest = line.replace(PERCENT, " ").replace(CLOCK, " ");
  const might: Reading[] = [];
  for (const m of rest.matchAll(AMOUNT)) {
    const unit = m[2] !== undefined;
    const value = amountOf(m[1] as string, m[2]);
    if (isAd && !isMight) {
      // "Alliance Duel 53" with no %: the research, never a might.
      if (!unit && ad.length === 0 && value <= 100) ad.push({ value, unit: false });
    } else if (unit ? value >= 10_000 : value >= 100_000 && Number.isInteger(value)) {
      might.push({ value, unit });
    }
  }
  return { might, ad };
}

/** A value with its unit first; otherwise one every line agrees on; otherwise none. */
function pick(readings: Reading[]): number | null {
  const withUnit = readings.find((r) => r.unit);
  if (withUnit) return withUnit.value;
  return new Set(readings.map((r) => r.value)).size === 1 ? (readings[0] as Reading).value : null;
}

/** The zones a line names, when it is about a time zone. A city or an offset counts only after "time zone". */
function zonesOf(line: string, now: Date, serverZone: string): string[] {
  const padded = ` ${wordsOf(line).join(" ")} `;
  const context = ZONE_WORDS.some((w) => padded.includes(` ${w} `)) || PREFIXED_OFFSET.test(line);
  const named = zonesNamed(line, now, serverZone);
  if (named.zones.length === 0) return [];
  if (context || named.via === "country") return named.zones;
  // PST, CET: an abbreviation in capitals; "est" is French for "is".
  const capitals = line
    .split(/[^\p{L}]+/u)
    .some((w) => w.length >= 3 && w === w.toUpperCase() && abbreviation(w.toLowerCase()));
  return named.via === "abbreviation" && capitals ? named.zones : [];
}

/**
 * "19,8", "19.8", "198": a bare number below 1,000 typed in the editor's might field, read in millions as
 * the sheet import reads its might column (D80); null for anything else. A trailing separator ("19,")
 * reads as the number before it, so the field's "M" stays while the officer types the decimal.
 */
export function millionsIn(text: string): number | null {
  const n = cellNumber(text.trim().replace(/[.,]$/, ""));
  return n && !n.percent && n.n < 1000 ? n.n : null;
}

/** The squad might typed in the editor's field ("19,8", "12.3M", "12 300 000"); null when it holds none. */
export function mightIn(text: string): number | null {
  const millions = millionsIn(text);
  if (millions !== null) return Math.round(millions * 1e6);
  return pick(text.split(/\r?\n/).flatMap((l) => readLine(l).might));
}

/** Reads the facts out of a pasted chat, or out of a chat picture's OCR lines. */
export function parseOnboarding(
  text: string | readonly string[],
  now: Date,
  serverZone: string,
): OnboardingFacts {
  const lines = (typeof text === "string" ? text.split(/\r?\n/) : [...text])
    .map((l) => l.trim())
    .filter((l) => l !== "");
  const read = lines.map(readLine);
  const timeZones = lines.map((l) => zonesOf(l, now, serverZone)).find((z) => z.length > 0) ?? [];
  const named = new Set(lines.flatMap(wordsOf).flatMap((w) => LANGUAGE_WORDS.get(w) ?? []));
  return {
    squadMight: pick(read.flatMap((r) => r.might)),
    adTech: pick(read.flatMap((r) => r.ad)),
    timeZones,
    languages: LANGUAGES.filter((code) => named.has(code)),
  };
}
