// The Discord Translate commands (D101), on a message's Apps menu. "Translate for me" answers only the
// person who asked, in their Discord language. "Translate for everyone" first shows them a picker (which
// languages; in a thread or the channel, as their channel permissions allow), then posts the chosen
// translations for everyone. Anyone in a workspace's Discord server may use both (issue 346; pending the
// owner's answer, D101). Only the text of the message the person chose is sent to the translator; nothing
// is stored but the rate limit's counters, and the log holds codes only. Each step answers Discord within
// 3 s; the translating runs after (discord-translate-run.ts).
import { createHash } from "node:crypto";

import { WRITING_LANGUAGES, type WritingLanguage } from "../ai/notice-writing";
import type { Db } from "../db";
import { currentCount, DAY_KEY_PREFIX, recordFailure } from "../repo/auth-attempts";
import { findWorkspaceByGuild } from "../repo/import";
import {
  pickWorkspaceLanguage,
  WORKSPACE_DICTIONARIES,
  type WorkspaceDictionary,
  type WorkspaceLanguage,
} from "./dictionary";
import { DEFERRED_REPLY, EPHEMERAL, REPLY, UPDATE, type Webhook } from "./discord-api";
import { privateLog } from "./log";
import {
  guessLanguage,
  languagesOf,
  mask,
  MAX_TRANSLATE_CHARS,
  parsePickerId,
  type Picker,
  pickerLine,
  pickerRows,
  placesFor,
  type Where,
} from "./translate-message";

/** Languages one person may have translated in a minute (one unit per language asked). */
export const TRANSLATE_PER_MINUTE = 5;
/**
 * Languages the whole app may have translated in a day. Groq's free tier allows 1,000 requests a day per
 * model; a language is one request, or up to two on each model with the untranslated retry (D81).
 */
export const TRANSLATE_PER_DAY = 300;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const DAY_KEY = `${DAY_KEY_PREFIX}translate`;

/** What the translating after the response needs. */
export interface TranslationJob {
  mode: "me" | "everyone";
  /** The asker's language: the reply's own words. */
  language: WorkspaceLanguage;
  /** The message's language when it is clear; null lets the model work it out. */
  from: WritingLanguage | null;
  to: WritingLanguage[];
  /** The text as sent to the model: mentions, links and custom emoji replaced by {n}. */
  text: string;
  kept: string[];
  webhook: Webhook;
  /** "Translate for everyone" only: where to post, and the picker to show again on a failure. */
  post?: { where: Where; channelId: string; link: string; picker: Picker; places: Where[] };
}

export interface TranslateAnswer {
  body: unknown;
  translation?: TranslationJob;
}

/** What the interaction carries that the commands use. */
export interface TranslateInput {
  guildId: string | undefined;
  channelId: string | undefined;
  userId: string | undefined;
  locale: string | undefined;
  /** The person's permissions in this channel, as Discord resolved them (decimal). */
  permissions: string | undefined;
  webhook: Webhook;
  /** Whether DISCORD_BOT_TOKEN is set, so the bot can open threads. */
  bot: boolean;
}

const privateReply = (content: string): TranslateAnswer => ({
  body: { type: REPLY, data: { content, flags: EPHEMERAL } },
});

const jumpLink = (input: TranslateInput, messageId: string) =>
  `https://discord.com/channels/${input.guildId}/${input.channelId}/${messageId}`;

/** The per-person key: a hash, so the person's Discord id is not what the table keeps. */
const personKey = (userId: string) =>
  `translate:${createHash("sha256").update(userId).digest("hex").slice(0, 32)}`;

/**
 * Counts `units` (languages) for the person and the day, or says which limit they would pass: then
 * nothing is counted.
 */
async function quota(db: Db, userId: string, units: number, now: Date) {
  const person = personKey(userId);
  if ((await currentCount(db, person, MINUTE_MS, now)) + units > TRANSLATE_PER_MINUTE) {
    privateLog("discord.translate.limited");
    return "person" as const;
  }
  if ((await currentCount(db, DAY_KEY, DAY_MS, now)) + units > TRANSLATE_PER_DAY) {
    privateLog("discord.translate.paused");
    return "day" as const;
  }
  await recordFailure(db, person, MINUTE_MS, now, units);
  await recordFailure(db, DAY_KEY, DAY_MS, now, units);
  return "ok" as const;
}

const quotaLine = (t: WorkspaceDictionary, refused: "person" | "day") =>
  refused === "day"
    ? t["translate.discord.paused"]
    : t["translate.discord.tooMany"].replace("{limit}", String(TRANSLATE_PER_MINUTE));

/** The message's text, checked and masked; or the line that says why it cannot be translated. */
function checkedText(
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
  content: string,
): { text: string; kept: string[] } | { refused: string } {
  const text = content.trim();
  if (text.length > MAX_TRANSLATE_CHARS) {
    const n = new Intl.NumberFormat(language);
    return {
      refused: t["translate.discord.tooLong"]
        .replace("{count}", n.format(text.length))
        .replace("{limit}", n.format(MAX_TRANSLATE_CHARS)),
    };
  }
  const masked = mask(text);
  // Only mentions, links, emoji, numbers: nothing for the model.
  if (!/\p{L}/u.test(masked.text)) return { refused: t["translate.discord.noText"] };
  return masked;
}

/**
 * The private picker: every language but the message's own, the first place the asker may use. It shows
 * the message's text: the Post step reads it back from here, so nothing is stored.
 */
function openPicker(
  t: WorkspaceDictionary,
  start: Pick<Picker, "messageId" | "userId" | "from">,
  places: Where[],
  bot: boolean,
  content: string,
): TranslateAnswer {
  const picker: Picker = {
    ...start,
    to: WRITING_LANGUAGES.filter((l) => l !== start.from),
    where: places[0] ?? "channel",
  };
  return {
    body: {
      type: REPLY,
      data: {
        content: pickerLine(t, places, bot),
        embeds: [{ description: content.trim() }],
        components: pickerRows(t, picker, places),
        allowed_mentions: { parse: [] },
        flags: EPHEMERAL,
      },
    },
  };
}

/** One of the two commands on a message, `content` being that message's text. */
export async function translateCommand(
  db: Db,
  mode: "me" | "everyone",
  input: TranslateInput,
  target: { messageId: string; content: string },
  now: Date,
): Promise<TranslateAnswer> {
  const language = pickWorkspaceLanguage(undefined, input.locale ?? null);
  const t = WORKSPACE_DICTIONARIES[language];
  const workspace = input.guildId ? await findWorkspaceByGuild(db, input.guildId) : null;
  if (!workspace || !input.userId || !input.channelId) {
    privateLog("discord.translate.refused");
    return privateReply(t["shots.discord.noDesk"]);
  }
  const places = placesFor(input.permissions, input.bot);
  if (mode === "everyone" && places.length === 0)
    return privateReply(t["translate.discord.cantPost"]);
  const checked = checkedText(t, language, target.content);
  if ("refused" in checked) return privateReply(checked.refused);
  const from = guessLanguage(checked.text);
  if (mode === "everyone") {
    const picker = { messageId: target.messageId, userId: input.userId, from };
    return openPicker(t, picker, places, input.bot, target.content);
  }
  if (from === language) return privateReply(t["translate.discord.same"]);
  const refused = await quota(db, input.userId, 1, now);
  if (refused !== "ok") return privateReply(quotaLine(t, refused));
  return {
    body: { type: DEFERRED_REPLY, data: { flags: EPHEMERAL } },
    translation: { mode, language, from, to: [language], ...checked, webhook: input.webhook },
  };
}

/** A change of languages, or of thread or channel: the picker is drawn again with it. */
function redraw(
  t: WorkspaceDictionary,
  places: Where[],
  action: "l" | "t" | "c",
  picker: Picker,
  values: readonly string[],
): TranslateAnswer {
  const asked: Where = action === "t" ? "thread" : "channel";
  const next: Picker =
    action === "l"
      ? { ...picker, to: languagesOf(values) }
      : { ...picker, where: places.includes(asked) ? asked : picker.where };
  return { body: { type: UPDATE, data: { components: pickerRows(t, next, places) } } };
}

/**
 * A press in the picker, null when it is not ours. Only the person who opened the picker may use it: its
 * custom_id carries their id, and the press must come from that person's own private picker (`owner`, from
 * the message's interaction metadata).
 */
export async function translateComponent(
  db: Db,
  input: TranslateInput,
  component: {
    customId: string;
    values: string[] | undefined;
    shownText: string | undefined;
    owner: string | undefined;
  },
  now: Date,
): Promise<TranslateAnswer | null> {
  const parsed = parsePickerId(component.customId);
  if (!parsed) return null;
  const t = WORKSPACE_DICTIONARIES[pickWorkspaceLanguage(undefined, input.locale ?? null)];
  const { action, picker } = parsed;
  const channelId = input.channelId;
  if (picker.userId !== input.userId || component.owner !== input.userId || !channelId) {
    return privateReply(t["translate.discord.notYours"]);
  }
  // The permissions are this press's own: a change since the picker opened counts.
  const places = placesFor(input.permissions, input.bot);
  if (action !== "p") return redraw(t, places, action, picker, component.values ?? []);
  return post(db, { ...input, channelId }, picker, places, component.shownText ?? "", now);
}

/**
 * Post: the place allowed, the text the picker shows checked again, the languages counted; then the picker
 * says "Translating…" without its buttons (so a second press cannot post twice) and the work runs after.
 */
async function post(
  db: Db,
  input: TranslateInput & { channelId: string },
  picker: Picker,
  places: Where[],
  shownText: string,
  now: Date,
): Promise<TranslateAnswer> {
  const language = pickWorkspaceLanguage(undefined, input.locale ?? null);
  const t = WORKSPACE_DICTIONARIES[language];
  const refuse = (content: string) => ({ body: { type: UPDATE, data: { content } } });
  if (!places.includes(picker.where)) return refuse(t["translate.discord.cantPost"]);
  const checked = checkedText(t, language, shownText);
  if ("refused" in checked) return refuse(checked.refused);
  const refused = await quota(db, picker.userId, picker.to.length, now);
  if (refused !== "ok") return refuse(quotaLine(t, refused));
  return {
    body: { type: UPDATE, data: { content: t["translate.discord.working"], components: [] } },
    translation: {
      mode: "everyone",
      language,
      // Asked for in the language it seemed to be in: the guess was wrong, so the model works it out.
      from: picker.from && picker.to.includes(picker.from) ? null : picker.from,
      to: picker.to,
      ...checked,
      webhook: input.webhook,
      post: {
        where: picker.where,
        channelId: input.channelId,
        link: jumpLink(input, picker.messageId),
        picker,
        places,
      },
    },
  };
}
