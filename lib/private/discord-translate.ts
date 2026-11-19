// The Discord Translate commands (D101), on a message's Apps menu. "Translate for me" answers only the
// person who asked, in their Discord language, with buttons for the other languages. "Translate for
// everyone" first shows them a picker (which languages; in a thread or the channel, as their channel
// permissions allow), then posts the chosen translations for everyone. Anyone in a workspace's Discord
// server may use both (issue 346; pending the owner's answer, D101). Only the text of the message the
// person chose is sent to the translator; nothing is stored but the rate limit's counters
// (translate-limits.ts), and the log holds codes only. Each step answers Discord within 3 s; the
// translating runs after (discord-translate-run.ts).
import { WRITING_LANGUAGES, type WritingLanguage } from "../ai/notice-writing";
import { eventWorkspace, type EventWorkspace } from "../analytics/server";
import type { Db } from "../db";
import { findWorkspaceByGuild } from "../repo/workspaces";
import {
  pickWorkspaceLanguage,
  WORKSPACE_DICTIONARIES,
  type WorkspaceDictionary,
  type WorkspaceLanguage,
} from "./dictionary";
import { DEFERRED_REPLY, EPHEMERAL, REPLY, UPDATE, type Webhook } from "./discord-api";
import { featureOn, featuresById, type WithFeatures } from "./features";
import { privateLog } from "./log";
import { checkedText, quota, quotaLine } from "./translate-limits";
import {
  forMeMessage,
  guessLanguage,
  languagesOf,
  parsePickerId,
  parseSwitchId,
  type Picker,
  pickerLine,
  pickerRows,
  placesFor,
  type Where,
} from "./translate-message";

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
  /** The asker: only they may press the "for me" language buttons. */
  userId: string;
  /** "For me": a language button was pressed, so on a failure the reply's text and buttons come back. */
  pressed?: boolean;
  /** "Translate for everyone" only: where to post, and the picker to show again on a failure. */
  post?: { where: Where; channelId: string; link: string; picker: Picker; places: Where[] };
  /** The server's workspace, found by its guild, for `$ai_generation` (issue 452); null once it is gone. */
  workspace: EventWorkspace | null;
}

/** The workspace of the server a press came from, for analytics only. */
async function workspaceOfGuild(db: Db, guildId: string | undefined) {
  const workspace = guildId ? await findWorkspaceByGuild(db, guildId) : null;
  return workspace && eventWorkspace(workspace);
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
  /** The person's roles in the server: which workspace it is when two share one (D126). */
  roles?: readonly string[] | undefined;
  webhook: Webhook;
  /** Whether DISCORD_BOT_TOKEN is set, so the bot can open threads. */
  bot: boolean;
}

const privateReply = (content: string): TranslateAnswer => ({
  body: { type: REPLY, data: { content, flags: EPHEMERAL } },
});

/** The server's workspace with the features the owner has on for it (D126), or null. */
async function guildWorkspace(db: Db, input: TranslateInput): Promise<WithFeatures | null> {
  const workspace = input.guildId
    ? await findWorkspaceByGuild(db, input.guildId, input.roles)
    : null;
  return workspace && { workspaceId: workspace.id, features: await featuresById(db, workspace.id) };
}

const COMMAND = { me: "discord_translate_me", everyone: "discord_translate_everyone" } as const;

/** Turned off for the alliance (D126): said at once, before anything is counted or translated. */
function turnedOff(ws: WithFeatures, mode: "me" | "everyone"): boolean {
  if (featureOn(ws, COMMAND[mode])) return false;
  privateLog("discord.translate.turned_off");
  return true;
}

const jumpLink = (input: TranslateInput, messageId: string) =>
  `https://discord.com/channels/${input.guildId}/${input.channelId}/${messageId}`;

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
  const ws = await guildWorkspace(db, input);
  if (!ws || !input.userId || !input.channelId) {
    privateLog("discord.translate.refused");
    return privateReply(t["shots.discord.noDesk"]);
  }
  if (turnedOff(ws, mode)) return privateReply(t["features.off.command"]);
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
  if (from === language) {
    // Already in the asker's language: the text, with a button for each other language.
    const already = forMeMessage(
      language,
      target.content.trim(),
      false,
      t["translate.discord.already"],
      input.userId,
    );
    return { body: { type: REPLY, data: { ...already, flags: EPHEMERAL } } };
  }
  const refused = await quota(db, input.userId, 1, now, { ws, allowance: "translate" });
  if (refused !== "ok") return privateReply(quotaLine(t, refused));
  return {
    body: { type: DEFERRED_REPLY, data: { flags: EPHEMERAL } },
    translation: {
      mode,
      language,
      from,
      to: [language],
      ...checked,
      webhook: input.webhook,
      userId: input.userId,
      workspace: eventWorkspace(workspace),
    },
  };
}

/**
 * A language button under a "for me" reply: the text the reply shows, translated into that language. One
 * unit, counted like the command; the reply says "Translating…" without its buttons at once (type 7), so a
 * second press has nothing to press, and is edited with the translation after.
 */
async function switchLanguage(
  db: Db,
  input: TranslateInput,
  pressed: { to: WritingLanguage; shown: WritingLanguage; userId: string },
  shownText: string,
  now: Date,
): Promise<TranslateAnswer> {
  const language = pickWorkspaceLanguage(undefined, input.locale ?? null);
  const t = WORKSPACE_DICTIONARIES[language];
  const refuse = (content: string) => ({ body: { type: UPDATE, data: { content } } });
  const ws = await guildWorkspace(db, input);
  if (!ws) return refuse(t["shots.discord.noDesk"]);
  if (turnedOff(ws, "me")) return refuse(t["features.off.command"]);
  const checked = checkedText(t, language, shownText);
  if ("refused" in checked) return refuse(checked.refused);
  const refused = await quota(db, pressed.userId, 1, now, { ws, allowance: "translate" });
  if (refused !== "ok") return refuse(quotaLine(t, refused));
  return {
    body: { type: UPDATE, data: { content: t["translate.discord.working"], components: [] } },
    translation: {
      mode: "me",
      language,
      from: pressed.shown,
      to: [pressed.to],
      ...checked,
      webhook: input.webhook,
      userId: pressed.userId,
      pressed: true,
      workspace: await workspaceOfGuild(db, input.guildId),
    },
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

/** What a press carries: its custom_id, a select's values, the text shown and who opened the message. */
interface Press {
  customId: string;
  values: string[] | undefined;
  shownText: string | undefined;
  owner: string | undefined;
}

/**
 * A press in the picker or on a "for me" reply, null when it is not ours. Only the person who opened it
 * may use it: its custom_id carries their id, and the press must come from that person's own private
 * message (`owner`, from the message's interaction metadata).
 */
export async function translateComponent(
  db: Db,
  input: TranslateInput,
  component: Press,
  now: Date,
): Promise<TranslateAnswer | null> {
  const switched = parseSwitchId(component.customId);
  if (!switched) return pickerPress(db, input, component, now);
  if (switched.userId !== input.userId || component.owner !== input.userId) {
    const t = WORKSPACE_DICTIONARIES[pickWorkspaceLanguage(undefined, input.locale ?? null)];
    return privateReply(t["translate.discord.notYours"]);
  }
  return switchLanguage(db, input, switched, component.shownText ?? "", now);
}

/** A press in the "Translate for everyone" picker. */
async function pickerPress(
  db: Db,
  input: TranslateInput,
  component: Press,
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
  const ws = await guildWorkspace(db, input);
  if (!ws) return refuse(t["shots.discord.noDesk"]);
  if (turnedOff(ws, "everyone")) return refuse(t["features.off.command"]);
  const checked = checkedText(t, language, shownText);
  if ("refused" in checked) return refuse(checked.refused);
  const refused = await quota(db, picker.userId, picker.to.length, now, {
    ws,
    allowance: "translate",
  });
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
      userId: picker.userId,
      post: {
        where: picker.where,
        channelId: input.channelId,
        link: jumpLink(input, picker.messageId),
        picker,
        places,
      },
      workspace: await workspaceOfGuild(db, input.guildId),
    },
  };
}
