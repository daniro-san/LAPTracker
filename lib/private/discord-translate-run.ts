// The translating after the Translate commands answered Discord (D101): each chosen language through the
// notices' translator (D81: glossary, own names, the untranslated check, the second model on a 429), then
// the reply. "For me" edits the private reply. "For everyone" posts in a thread on the message (the bot,
// with DISCORD_BOT_TOKEN) or in the channel (the interaction's webhook), each public post saying who asked,
// then tells the asker where each language went. No text is logged: codes and numbers only. Nothing posted
// can ping anyone.
import { ChatError, type ChatModel } from "../ai/groq";
import { translateText, type WritingLanguage } from "../ai/notice-writing";
import {
  WORKSPACE_DICTIONARIES,
  type WorkspaceDictionary,
  type WorkspaceLanguage,
} from "./dictionary";
import { editOriginal, type Webhook } from "./discord-api";
import type { TranslationJob } from "./discord-translate";
import { privateLog } from "./log";
import {
  HEADING,
  languageList,
  messagesOf,
  partlyLine,
  pickerRows,
  unmask,
} from "./translate-message";

const TIMEOUT_MS = 10_000;
/** A thread lasts a day without new messages, then Discord archives it. */
const THREAD_ARCHIVE_MINUTES = 1440;
/** Discord's answer when the message already has a thread, whose id is the message's own. */
const THREAD_EXISTS = 160004;
const NO_PINGS = { parse: [] };

export interface TranslationDeps {
  ai: ChatModel | null;
  fetch: typeof fetch;
  /** DISCORD_API_BASE_URL. */
  discordBase: string;
  /** DISCORD_BOT_TOKEN: only sent to Discord, as `Authorization: Bot …`. */
  botToken: string | undefined;
  now: () => Date;
}

interface Done {
  to: WritingLanguage;
  text: string;
  partly: boolean;
}

type Post = NonNullable<TranslationJob["post"]>;

/** One call to Discord; the response, or null on a network error or timeout. */
function discord(deps: TranslationDeps, path: string, body: unknown, bot = false) {
  return deps
    .fetch(`${deps.discordBase.replace(/\/$/, "")}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(bot && { authorization: `Bot ${deps.botToken}` }),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    .catch(() => null);
}

/** Edits the asker's own message (the private reply or the picker). */
async function editOwn(deps: TranslationDeps, webhook: Webhook, message: object): Promise<void> {
  const res = await editOriginal(deps.fetch, deps.discordBase, webhook, message);
  if (!res?.ok) privateLog("discord.translate.reply_failed", { status: res?.status ?? 0 });
}

/** Every language translated, in parallel; a language already the message's own is left out. */
async function translateAll(ai: ChatModel, job: TranslationJob) {
  const settled = await Promise.allSettled(
    job.to.map((to) => translateText(ai, job.from, to, job.text)),
  );
  const done: Done[] = [];
  const failed: WritingLanguage[] = [];
  let failure: ChatError | null = null;
  for (const [i, s] of settled.entries()) {
    const to = job.to[i];
    if (!to) continue;
    if (s.status === "rejected") {
      failed.push(to);
      failure = s.reason instanceof ChatError ? s.reason : new ChatError("failed");
    } else if (!s.value.same) {
      done.push({ to, text: unmask(s.value.text, job.kept), partly: s.value.partly });
    }
  }
  return { done, failed, failure };
}

const embedOf = (d: Done) => ({
  title: HEADING[d.to],
  description: d.text,
  ...(d.partly && { footer: { text: partlyLine(d.to) } }),
});

const failureLine = (t: WorkspaceDictionary, failure: ChatError | null) =>
  failure?.kind === "busy"
    ? t["notices.ai.busy"]
    : failure?.kind === "timeout"
      ? t["notices.ai.timeout"]
      : t["translate.discord.failed"];

/** The small "Asked by @name" line on every public post; mentions are off, so it pings no one. */
const askedBy = (t: WorkspaceDictionary, userId: string) =>
  `-# ${t["translate.discord.askedBy"].replace("{user}", `<@${userId}>`)}`;

/**
 * The bot's thread on the message: a new one, or the one it already has; null when the bot cannot open
 * one here (no permission, a forum post, a message inside a thread).
 */
async function openThread(deps: TranslationDeps, post: Post, name: string): Promise<string | null> {
  const { channelId, picker } = post;
  const res = await discord(
    deps,
    `/channels/${channelId}/messages/${picker.messageId}/threads`,
    { name, auto_archive_duration: THREAD_ARCHIVE_MINUTES },
    true,
  );
  const answer = (await res?.json().catch(() => null)) as { id?: string; code?: number } | null;
  if (res?.ok && answer?.id) return answer.id;
  if (answer?.code === THREAD_EXISTS) return picker.messageId;
  privateLog("discord.translate.thread_refused", { status: res?.status ?? 0 });
  return null;
}

/**
 * Each language as the bot's messages in the message's thread, the first one led by "Asked by". The
 * languages fully posted, in order (it stops at the first post Discord refuses); null when no thread.
 */
async function postInThread(
  deps: TranslationDeps,
  post: Post,
  done: Done[],
  t: WorkspaceDictionary,
): Promise<Done[] | null> {
  if (!deps.botToken) return null;
  const threadId = await openThread(deps, post, t["translate.discord.thread"]);
  if (!threadId) return null;
  const sent: Done[] = [];
  for (const d of done) {
    const lead = sent.length === 0 ? `${askedBy(t, post.picker.userId)}\n` : "";
    for (const content of messagesOf(d.to, d.text, lead)) {
      const res = await discord(
        deps,
        `/channels/${threadId}/messages`,
        { content, allowed_mentions: NO_PINGS },
        true,
      );
      if (!res?.ok) {
        privateLog("discord.translate.thread_post_failed", { status: res?.status ?? 0 });
        return sent;
      }
    }
    sent.push(d);
  }
  return sent;
}

/** The translations as one public follow-up in the channel: the message's link, who asked, the languages. */
async function postInChannel(
  deps: TranslationDeps,
  job: TranslationJob,
  post: Post,
  done: Done[],
): Promise<boolean> {
  const t = WORKSPACE_DICTIONARIES[job.language];
  const { applicationId, token } = job.webhook;
  const res = await discord(deps, `/webhooks/${applicationId}/${token}`, {
    content: `${post.link}\n${askedBy(t, post.picker.userId)}`,
    embeds: done.map(embedOf),
    allowed_mentions: NO_PINGS,
  });
  if (!res?.ok) privateLog("discord.translate.channel_failed", { status: res?.status ?? 0 });
  return res?.ok ?? false;
}

/** What the asker reads about where the translations went; null when nothing was posted at all. */
function placeLine(
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
  where: Post["where"],
  inThread: Done[] | null,
  rest: Done[],
  channelOk: boolean,
): string | null {
  const names = (ds: Done[]) =>
    languageList(
      language,
      ds.map((d) => d.to),
    );
  if (!channelOk && !inThread?.length) return null;
  if (where === "channel") return t["translate.discord.posted"];
  if (inThread === null) return t["translate.discord.noThread"];
  if (rest.length === 0) return t["translate.discord.postedThread"];
  if (inThread.length === 0) return t["translate.discord.threadStopped"];
  const first = t["translate.discord.inThreadList"].replace("{languages}", names(inThread));
  const second = channelOk
    ? t["translate.discord.restInChannel"].replace("{languages}", names(rest))
    : t["translate.discord.failed"];
  return `${first} ${second}`;
}

/** "For everyone": translate, post in the thread or the channel, then say where each language went. */
async function forEveryone(deps: TranslationDeps, ai: ChatModel, job: TranslationJob) {
  const t = WORKSPACE_DICTIONARIES[job.language];
  const post = job.post;
  if (!post) return;
  // On a failure the picker comes back with its buttons, so the asker can try again.
  const again = { components: pickerRows(t, post.picker, post.places) };
  const { done, failed, failure } = await translateAll(ai, job);
  if (done.length === 0) {
    const content = failure ? failureLine(t, failure) : t["translate.discord.nothing"];
    await editOwn(deps, job.webhook, failure ? { content, ...again } : { content, embeds: [] });
    return;
  }
  const inThread = post.where === "thread" ? await postInThread(deps, post, done, t) : null;
  const rest = done.filter((d) => !inThread?.includes(d));
  const channelOk = rest.length === 0 || (await postInChannel(deps, job, post, rest));
  logPlaces(inThread?.length ?? 0, channelOk ? rest.length : 0);
  const line = placeLine(t, job.language, post.where, inThread, rest, channelOk);
  if (line === null) {
    await editOwn(deps, job.webhook, { content: t["translate.discord.failed"], ...again });
    return;
  }
  const missing = failed.length ? `\n${missingLine(t, job.language, failed, failure)}` : "";
  await editOwn(deps, job.webhook, { content: `${line}${missing}`, embeds: [], components: [] });
}

/** How many languages went to each place: runtime log lines only (D101). */
function logPlaces(inThread: number, inChannel: number) {
  if (inThread > 0) privateLog("discord.translate.thread", { languages: inThread });
  if (inChannel > 0) privateLog("discord.translate.channel", { languages: inChannel });
}

/** "Not translated: 🇫🇷 Français." and why. */
const missingLine = (
  t: WorkspaceDictionary,
  language: WorkspaceLanguage,
  failed: WritingLanguage[],
  failure: ChatError | null,
) =>
  `${t["translate.discord.missing"].replace("{languages}", languageList(language, failed))} ${failureLine(t, failure)}`;

/** "For me": the private reply becomes the translation, or a line saying why there is none. */
async function forMe(deps: TranslationDeps, ai: ChatModel, job: TranslationJob) {
  const t = WORKSPACE_DICTIONARIES[job.language];
  const { done, failure } = await translateAll(ai, job);
  if (done.length > 0) privateLog("discord.translate.me", { languages: done.length });
  const message =
    done.length > 0
      ? { embeds: done.map(embedOf) }
      : { content: failure ? failureLine(t, failure) : t["translate.discord.same"] };
  await editOwn(deps, job.webhook, message);
}

export async function runTranslation(deps: TranslationDeps, job: TranslationJob): Promise<void> {
  const ai = deps.ai;
  if (!ai) {
    privateLog("discord.translate.off");
    const off = WORKSPACE_DICTIONARIES[job.language]["translate.discord.off"];
    await editOwn(deps, job.webhook, { content: off, components: [] });
    return;
  }
  const started = deps.now().getTime();
  await (job.mode === "me" ? forMe(deps, ai, job) : forEveryone(deps, ai, job));
  privateLog("discord.translate.done", { ms: deps.now().getTime() - started });
}
