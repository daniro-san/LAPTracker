// The Discord Translate commands (D101), on a message's Apps menu. "Translate for me" answers only the
// person who asked, in their Discord language. "Translate for everyone" first shows them a picker (which
// languages; in a thread or the channel), then posts the chosen translations for everyone. Anyone in a
// workspace's Discord server may use both (issue 346). Only the text of the message the person chose is
// sent to the translator; nothing is stored but a per-person counter for the rate limit, and the log holds
// codes only. Each step answers Discord within 3 s; the translating runs after (discord-translate-run.ts).
import { createHash } from "node:crypto";

import { WRITING_LANGUAGES, type WritingLanguage } from "../ai/notice-writing";
import type { Db } from "../db";
import { recordFailure } from "../repo/auth-attempts";
import { findWorkspaceByGuild } from "../repo/import";
import {
  pickWorkspaceLanguage,
  WORKSPACE_DICTIONARIES,
  type WorkspaceDictionary,
  type WorkspaceLanguage,
} from "./dictionary";
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
  type Where,
} from "./translate-message";

/** Translations one person may ask for in a minute: the free tier has 1,000 requests a day per model. */
export const TRANSLATE_PER_MINUTE = 5;
const MINUTE_MS = 60_000;

/** Discord's interaction response types and the flag used here. */
const REPLY = 4;
const DEFERRED_REPLY = 5;
const DEFERRED_UPDATE = 6;
const UPDATE = 7;
const EPHEMERAL = 64;

export interface Webhook {
  applicationId: string;
  token: string;
}

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
  post?: { where: Where; channelId: string; link: string; picker: Picker; threads: boolean };
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
  webhook: Webhook;
  /** Whether DISCORD_BOT_TOKEN is set, so the bot can open threads. */
  threads: boolean;
}

const privateReply = (content: string): TranslateAnswer => ({
  body: { type: REPLY, data: { content, flags: EPHEMERAL } },
});

const jumpLink = (input: TranslateInput, messageId: string) =>
  `https://discord.com/channels/${input.guildId}/${input.channelId}/${messageId}`;

/** The rate limit's key: a hash, so the person's Discord id is not what the table keeps. */
const limitKey = (userId: string) =>
  `translate:${createHash("sha256").update(userId).digest("hex").slice(0, 32)}`;

/** Counts one translation for the person; true when they are over the limit. */
async function overLimit(db: Db, userId: string, now: Date): Promise<boolean> {
  const count = await recordFailure(db, limitKey(userId), MINUTE_MS, now);
  if (count <= TRANSLATE_PER_MINUTE) return false;
  privateLog("discord.translate.limited");
  return true;
}

const tooMany = (t: WorkspaceDictionary) =>
  t["translate.discord.tooMany"].replace("{limit}", String(TRANSLATE_PER_MINUTE));

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
  const checked = checkedText(t, language, target.content);
  if ("refused" in checked) return privateReply(checked.refused);
  const from = guessLanguage(checked.text);
  if (mode === "everyone") {
    const picker: Picker = {
      messageId: target.messageId,
      userId: input.userId,
      from,
      to: WRITING_LANGUAGES.filter((l) => l !== from),
      where: input.threads ? "thread" : "channel",
    };
    // The picker shows the message's text: the Post step reads it back from here, so nothing is stored.
    return {
      body: {
        type: REPLY,
        data: {
          content: pickerLine(t, input.threads),
          embeds: [{ description: target.content.trim() }],
          components: pickerRows(t, picker, input.threads),
          allowed_mentions: { parse: [] },
          flags: EPHEMERAL,
        },
      },
    };
  }
  if (from === language) return privateReply(t["translate.discord.same"]);
  if (await overLimit(db, input.userId, now)) return privateReply(tooMany(t));
  return {
    body: { type: DEFERRED_REPLY, data: { flags: EPHEMERAL } },
    translation: { mode, language, from, to: [language], ...checked, webhook: input.webhook },
  };
}

/** A change of languages, or of thread or channel: the picker is drawn again with it. */
function redraw(
  t: WorkspaceDictionary,
  input: TranslateInput,
  action: "l" | "t" | "c",
  picker: Picker,
  values: readonly string[],
): TranslateAnswer {
  const next: Picker =
    action === "l"
      ? { ...picker, to: languagesOf(values) }
      : { ...picker, where: action === "t" && input.threads ? "thread" : "channel" };
  return { body: { type: UPDATE, data: { components: pickerRows(t, next, input.threads) } } };
}

/**
 * A press in the picker, null when it is not ours. Only the person who opened the picker may use it: its
 * custom_id carries their id and the message's.
 */
export async function translateComponent(
  db: Db,
  input: TranslateInput,
  component: { customId: string; values: string[] | undefined; shownText: string | undefined },
  now: Date,
): Promise<TranslateAnswer | null> {
  const parsed = parsePickerId(component.customId);
  if (!parsed) return null;
  const t = WORKSPACE_DICTIONARIES[pickWorkspaceLanguage(undefined, input.locale ?? null)];
  const { action, picker } = parsed;
  const channelId = input.channelId;
  if (picker.userId !== input.userId || !channelId) {
    return privateReply(t["translate.discord.notYours"]);
  }
  if (action !== "p") return redraw(t, input, action, picker, component.values ?? []);
  return post(db, { ...input, channelId }, picker, component.shownText ?? "", now);
}

/** Post: the text the picker shows, checked again, counted, then translated after the answer. */
async function post(
  db: Db,
  input: TranslateInput & { channelId: string },
  picker: Picker,
  shownText: string,
  now: Date,
): Promise<TranslateAnswer> {
  const language = pickWorkspaceLanguage(undefined, input.locale ?? null);
  const t = WORKSPACE_DICTIONARIES[language];
  const checked = checkedText(t, language, shownText);
  if ("refused" in checked) return { body: { type: UPDATE, data: { content: checked.refused } } };
  if (await overLimit(db, picker.userId, now)) {
    return { body: { type: UPDATE, data: { content: tooMany(t) } } };
  }
  return {
    body: { type: DEFERRED_UPDATE },
    translation: {
      mode: "everyone",
      language,
      // Asked for in the language it seemed to be in: the guess was wrong, so the model works it out.
      from: picker.from && picker.to.includes(picker.from) ? null : picker.from,
      to: picker.to,
      ...checked,
      webhook: input.webhook,
      post: {
        where: input.threads ? picker.where : "channel",
        channelId: input.channelId,
        link: jumpLink(input, picker.messageId),
        picker,
        threads: input.threads,
      },
    },
  };
}
