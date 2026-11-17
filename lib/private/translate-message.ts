// The pure parts of the Discord Translate commands (D101): which language a message is probably in, the
// Discord pieces kept out of the model's reach, the "Translate for everyone" picker and its state, and the
// text of what is posted. No database, no network.
import { WRITING_LANGUAGES, type WritingLanguage } from "../ai/notice-writing";
import { WORKSPACE_DICTIONARIES, type WorkspaceDictionary } from "./dictionary";

/** A longer message gets a plain "too long" line; Discord's own limit is 2,000 (4,000 with Nitro). */
export const MAX_TRANSLATE_CHARS = 1500;
/** What one Discord message holds. */
const DISCORD_MESSAGE_CHARS = 2000;

/** Each language's own name with its flag, as the picker and the posts show it. */
export const HEADING: Record<WritingLanguage, string> = {
  en: "🇬🇧 English",
  "pt-BR": "🇧🇷 Português",
  fr: "🇫🇷 Français",
};

/** Short words that only one of the three languages uses (words two of them share are left out). */
const MARKERS: Record<WritingLanguage, ReadonlySet<string>> = {
  en: new Set(
    "the and you your is are to of for we our please all with this that be will have it in at today tomorrow everyone thanks guys what don't can".split(
      " ",
    ),
  ),
  "pt-BR": new Set(
    "o os e é que não para pra com um uma na nos vocês você por pessoal nós está estão hoje amanhã obrigado obrigada tem mais muito isso aqui seu sua também bom dia".split(
      " ",
    ),
  ),
  fr: new Set(
    "le la les du des et est pas pour avec une dans vous nous sur ce cette il je merci demain tout tous au aux ne qui votre vos sont bonjour".split(
      " ",
    ),
  ),
};
/** Letters only one of the three languages writes. */
const LETTERS: Record<WritingLanguage, RegExp> = {
  en: /(?!)/u,
  "pt-BR": /[ãõ]/u,
  fr: /[èùœë]/u,
};

/**
 * The language a message is most probably in, from its short words and letters; null when no language
 * clearly leads ("ok", a name, a time, or a fourth language). The caller then asks the model without one.
 */
export function guessLanguage(text: string): WritingLanguage | null {
  const lower = text.toLowerCase();
  const words = lower.match(/[\p{L}']+/gu) ?? [];
  const scores = WRITING_LANGUAGES.map((language) => ({
    language,
    score:
      words.filter((w) => MARKERS[language].has(w)).length +
      (LETTERS[language].test(lower) ? 2 : 0),
  })).sort((a, b) => b.score - a.score);
  const [first, second] = scores;
  return first && first.score > 0 && first.score > (second?.score ?? 0) ? first.language : null;
}

/**
 * Mentions (@user, @role, #channel, @everyone, @here), custom emoji, timestamps, slash-command mentions and
 * links: kept verbatim, so they never reach the model and are put back as they were.
 */
const KEPT_TOKEN =
  /<(?:@[!&]?\d+|#\d+|a?:\w+:\d+|t:-?\d+(?::[tTdDfFR])?|\/[^\s>]+:\d+)>|https?:\/\/[^\s<>]+|@(?:everyone|here)\b/g;

/** The text with each kept piece replaced by {1}, {2}, … and the pieces in order. */
export function mask(text: string): { text: string; kept: string[] } {
  const kept: string[] = [];
  const masked = text.replace(KEPT_TOKEN, (token) => `{${kept.push(token)}}`);
  return { text: masked, kept };
}

/** Puts the kept pieces back in place of their {n}. */
export const unmask = (text: string, kept: readonly string[]): string =>
  text.replace(/\{(\d+)\}/g, (found, n: string) => kept[Number(n) - 1] ?? found);

/** A heading line and the text, cut at line breaks (or spaces) into pieces one Discord message holds. */
export function messagesOf(to: WritingLanguage, text: string): string[] {
  const out: string[] = [];
  let rest = `**${HEADING[to]}**\n${text}`;
  while (rest.length > DISCORD_MESSAGE_CHARS) {
    const window = rest.slice(0, DISCORD_MESSAGE_CHARS);
    const cut = Math.max(window.lastIndexOf("\n"), window.lastIndexOf(" "));
    const at = cut > 0 ? cut : DISCORD_MESSAGE_CHARS;
    out.push(rest.slice(0, at));
    rest = rest.slice(at).trimStart();
  }
  return [...out, rest];
}

export type Where = "thread" | "channel";

/** What the "Translate for everyone" picker holds; it travels in each component's custom_id. */
export interface Picker {
  /** The message to translate, and the person who asked: only they can use the picker. */
  messageId: string;
  userId: string;
  /** The guessed language of the message, or null. */
  from: WritingLanguage | null;
  to: WritingLanguage[];
  where: Where;
}

const CODE: Record<WritingLanguage, string> = { en: "e", "pt-BR": "p", fr: "f" };
const byCode = (c: string) => WRITING_LANGUAGES.find((l) => CODE[l] === c);
/** The picker's actions: l the language select, t and c the Thread and Channel buttons, p Post. */
export type PickerAction = "l" | "t" | "c" | "p";

/** "tr:<action>:<message>:<user>:<from>:<to>:<where>", under Discord's 100 characters. */
export const pickerId = (action: PickerAction, p: Picker): string =>
  [
    "tr",
    action,
    p.messageId,
    p.userId,
    p.from ? CODE[p.from] : "x",
    p.to.map((l) => CODE[l]).join(""),
    p.where[0],
  ].join(":");

export function parsePickerId(id: string): { action: PickerAction; picker: Picker } | null {
  const m = /^tr:([ltcp]):(\d{1,20}):(\d{1,20}):([epfx]):([epf]{0,3}):([tc])$/.exec(id);
  if (!m) return null;
  const [, action, messageId, userId, from, to, where] = m as unknown as string[];
  return {
    action: action as PickerAction,
    picker: {
      messageId: messageId ?? "",
      userId: userId ?? "",
      from: byCode(from ?? "") ?? null,
      to: [...(to ?? "")].flatMap((c) => byCode(c) ?? []),
      where: where === "t" ? "thread" : "channel",
    },
  };
}

/** Values a select sends back, as languages, in the usual order. */
export const languagesOf = (values: readonly string[]): WritingLanguage[] =>
  WRITING_LANGUAGES.filter((l) => values.includes(CODE[l]));

/** Discord's component types and button styles used by the picker. */
const ROW = 1;
const BUTTON = 2;
const SELECT = 3;
const PRIMARY = 1;
const SECONDARY = 2;

/**
 * The picker's rows: the languages (at least one), Thread or Channel when the bot can open threads, and
 * Post. Each component carries the whole state, so the app keeps nothing between the steps.
 */
export function pickerRows(t: WorkspaceDictionary, p: Picker, threads: boolean): unknown[] {
  const languages = {
    type: SELECT,
    custom_id: pickerId("l", p),
    placeholder: t["translate.discord.languages"],
    min_values: 1,
    max_values: WRITING_LANGUAGES.length,
    options: WRITING_LANGUAGES.map((l) => ({
      label: HEADING[l],
      value: CODE[l],
      default: p.to.includes(l),
    })),
  };
  const place = (action: "t" | "c", where: Where) => ({
    type: BUTTON,
    custom_id: pickerId(action, p),
    label: t[where === "thread" ? "translate.discord.inThread" : "translate.discord.inChannel"],
    style: p.where === where ? PRIMARY : SECONDARY,
  });
  const post = {
    type: BUTTON,
    custom_id: pickerId("p", p),
    label: t["translate.discord.post"],
    style: PRIMARY,
  };
  return [
    { type: ROW, components: [languages] },
    ...(threads ? [{ type: ROW, components: [place("t", "thread"), place("c", "channel")] }] : []),
    { type: ROW, components: [post] },
  ];
}

/** The picker's first line: what to do, and why there is no Thread without the bot. */
export const pickerLine = (t: WorkspaceDictionary, threads: boolean): string =>
  threads
    ? t["translate.discord.choose"]
    : `${t["translate.discord.chooseChannel"]}\n${t["translate.discord.noBot"]}`;

/** The reply's "partly untranslated" line, in the language of the translation it is under. */
export const partlyLine = (to: WritingLanguage): string =>
  WORKSPACE_DICTIONARIES[to]["notices.draft.partly"];
