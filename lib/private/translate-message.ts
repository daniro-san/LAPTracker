// The pure parts of the Discord Translate commands (D101): which language a message is probably in, the
// Discord pieces kept out of the model's reach, the "Translate for everyone" picker and its state, the
// "Translate for me" reply and its language buttons, and the text of what is posted. No database, no network.
import { WRITING_LANGUAGES, type WritingLanguage } from "../ai/notice-writing";
import {
  WORKSPACE_DICTIONARIES,
  type WorkspaceDictionary,
  type WorkspaceLanguage,
} from "./dictionary";
import { CREATE_PUBLIC_THREADS, SEND_MESSAGES, SEND_MESSAGES_IN_THREADS } from "./discord-api";

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

/**
 * Short words that only one of the three languages uses. Words two of them share are left out ("que",
 * "mais" and "nos" are French too).
 */
const MARKERS: Record<WritingLanguage, ReadonlySet<string>> = {
  en: new Set(
    "the and you your is are to of for we our please all with this that be will have it in at today tomorrow everyone thanks guys what don't can".split(
      " ",
    ),
  ),
  "pt-BR": new Set(
    "o os e é não para pra com um uma na vocês você por pessoal nós está estão hoje amanhã obrigado obrigada tem muito isso aqui seu sua também bom dia".split(
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
  // The curly apostrophe (don’t) counts as the straight one.
  const lower = text.toLowerCase().replace(/’/g, "'");
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

/**
 * `lead` (a line, or nothing), a heading line and the text, cut at line breaks (or spaces) into pieces one
 * Discord message holds.
 */
export function messagesOf(to: WritingLanguage, text: string, lead = ""): string[] {
  const out: string[] = [];
  let rest = `${lead}**${HEADING[to]}**\n${text}`;
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

/**
 * Where the asker may post, from their permissions in this channel (Discord resolves them into
 * `member.permissions`): a thread needs the bot and Create Public Threads with Send Messages in Threads;
 * the channel needs Send Messages. Empty: they cannot post here.
 */
export function placesFor(permissions: string | undefined, bot: boolean): Where[] {
  const has = BigInt(permissions ?? "0");
  const all = (bits: bigint) => (has & bits) === bits;
  return [
    ...(bot && all(CREATE_PUBLIC_THREADS | SEND_MESSAGES_IN_THREADS) ? (["thread"] as const) : []),
    ...(all(SEND_MESSAGES) ? (["channel"] as const) : []),
  ];
}

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
const ACTIONS = ["l", "t", "c", "p"] as const;
export type PickerAction = (typeof ACTIONS)[number];

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
  const g =
    /^tr:(?<action>[ltcp]):(?<message>\d{1,20}):(?<user>\d{1,20}):(?<from>[epfx]):(?<to>[epf]{0,3}):(?<where>[tc])$/.exec(
      id,
    )?.groups;
  const action = ACTIONS.find((a) => a === g?.action);
  if (!g || !action) return null;
  return {
    action,
    picker: {
      messageId: g.message ?? "",
      userId: g.user ?? "",
      from: byCode(g.from ?? "") ?? null,
      to: [...(g.to ?? "")].flatMap((c) => byCode(c) ?? []),
      where: g.where === "t" ? "thread" : "channel",
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
 * The picker's rows: the languages (at least one), Thread or Channel when the asker may use both, and
 * Post. Each component carries the whole state, so the app keeps nothing between the steps.
 */
export function pickerRows(t: WorkspaceDictionary, p: Picker, places: readonly Where[]): unknown[] {
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
    ...(places.length > 1
      ? [{ type: ROW, components: [place("t", "thread"), place("c", "channel")] }]
      : []),
    { type: ROW, components: [post] },
  ];
}

/** The picker's first line: what to do and where it goes, and why there is no Thread without the bot. */
export function pickerLine(t: WorkspaceDictionary, places: readonly Where[], bot: boolean): string {
  if (places.length > 1) return t["translate.discord.choose"];
  if (places[0] === "thread") return t["translate.discord.chooseThread"];
  const line = t["translate.discord.chooseChannel"];
  return bot ? line : `${line}\n${t["translate.discord.noBot"]}`;
}

/** Languages by name, as a list in the asker's language ("🇧🇷 Português and 🇫🇷 Français"). */
export const languageList = (language: WorkspaceLanguage, languages: readonly WritingLanguage[]) =>
  new Intl.ListFormat(language).format(languages.map((l) => HEADING[l]));

/** The reply's "partly untranslated" line, in the language of the translation it is under. */
export const partlyLine = (to: WritingLanguage): string =>
  WORKSPACE_DICTIONARIES[to]["notices.draft.partly"];

/** Each language's own name, as the "for me" buttons show it. */
const NAME: Record<WritingLanguage, string> = {
  en: "English",
  "pt-BR": "Português",
  fr: "Français",
};

/**
 * A "for me" language button: "tm:<to>:<shown>:<user>". `shown` is the language of the text the private
 * reply shows, which a press translates; only that user may press it.
 */
const switchId = (to: WritingLanguage, shown: WritingLanguage, userId: string) =>
  `tm:${CODE[to]}:${CODE[shown]}:${userId}`;

export function parseSwitchId(
  id: string,
): { to: WritingLanguage; shown: WritingLanguage; userId: string } | null {
  const g = /^tm:(?<to>[epf]):(?<shown>[epf]):(?<user>\d{1,20})$/.exec(id)?.groups;
  const to = byCode(g?.to ?? "");
  const shown = byCode(g?.shown ?? "");
  return to && shown && g?.user ? { to, shown, userId: g.user } : null;
}

/** A button for each language but the one shown. */
export const switchRows = (shown: WritingLanguage, userId: string): unknown[] => [
  {
    type: ROW,
    components: WRITING_LANGUAGES.filter((l) => l !== shown).map((l) => ({
      type: BUTTON,
      custom_id: switchId(l, shown, userId),
      label: NAME[l],
      style: SECONDARY,
    })),
  },
];

/**
 * The "for me" private reply: the text in `shown` under its heading, `line` ("Already in English.
 * Translate to:" or "Other language:") small under it, and the other languages' buttons. A press reads the
 * text back from this embed, so nothing is stored.
 */
export function forMeMessage(
  shown: WritingLanguage,
  text: string,
  partly: boolean,
  line: string,
  userId: string,
) {
  return {
    embeds: [
      {
        title: HEADING[shown],
        description: text,
        footer: { text: partly ? `${partlyLine(shown)}\n${line}` : line },
      },
    ],
    components: switchRows(shown, userId),
    allowed_mentions: { parse: [] },
  };
}
