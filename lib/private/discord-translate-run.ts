// The translating after the Translate commands answered Discord (D101): each chosen language through the
// notices' translator (D81: glossary, own names, the untranslated check, the second model on a 429), then
// the reply. "For me" edits the private reply. "For everyone" posts in a thread on the message (the bot,
// with DISCORD_BOT_TOKEN) or in the channel (the interaction's webhook), then tells the asker where it went.
// No text is logged: codes and numbers only. Nothing posted can ping anyone.
import { ChatError, type ChatModel } from "../ai/groq";
import { translateText, type WritingLanguage } from "../ai/notice-writing";
import { WORKSPACE_DICTIONARIES, type WorkspaceDictionary } from "./dictionary";
import type { TranslationJob, Webhook } from "./discord-translate";
import { privateLog } from "./log";
import { HEADING, messagesOf, partlyLine, pickerRows, unmask } from "./translate-message";

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

/** One call to Discord; the response, or null on a network error or timeout. */
function discord(deps: TranslationDeps, path: string, method: string, body: unknown, bot = false) {
  return deps
    .fetch(`${deps.discordBase.replace(/\/$/, "")}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(bot && { authorization: `Bot ${deps.botToken}` }),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    .catch(() => null);
}

/** Edits the asker's own message (the private reply or the picker); true when Discord took it. */
async function editOwn(deps: TranslationDeps, webhook: Webhook, message: object): Promise<boolean> {
  const path = `/webhooks/${webhook.applicationId}/${webhook.token}/messages/@original`;
  const res = await discord(deps, path, "PATCH", { ...message, allowed_mentions: NO_PINGS });
  if (!res?.ok) privateLog("discord.translate.reply_failed", { status: res?.status ?? 0 });
  return res?.ok ?? false;
}

/** Every language translated, in parallel; a language already the message's own is left out. */
async function translateAll(ai: ChatModel, job: TranslationJob) {
  const settled = await Promise.allSettled(
    job.to.map((to) => translateText(ai, job.from, to, job.text)),
  );
  const done: Done[] = [];
  let failure: ChatError | null = null;
  settled.forEach((s, i) => {
    const to = job.to[i];
    if (s.status === "rejected") {
      failure = s.reason instanceof ChatError ? s.reason : new ChatError("failed");
    } else if (to && !s.value.same) {
      done.push({ to, text: unmask(s.value.text, job.kept), partly: s.value.partly });
    }
  });
  return { done, failure: failure as ChatError | null };
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

/**
 * The bot's thread on the message: a new one, or the one it already has; null when the bot cannot open
 * one here (no permission, a forum post, a message inside a thread). Then each language is a message.
 */
async function openThread(
  deps: TranslationDeps,
  post: NonNullable<TranslationJob["post"]>,
  name: string,
): Promise<string | null> {
  const { channelId, picker } = post;
  const res = await discord(
    deps,
    `/channels/${channelId}/messages/${picker.messageId}/threads`,
    "POST",
    { name, auto_archive_duration: THREAD_ARCHIVE_MINUTES },
    true,
  );
  const answer = (await res?.json().catch(() => null)) as { id?: string; code?: number } | null;
  if (res?.ok && answer?.id) return answer.id;
  if (answer?.code === THREAD_EXISTS) return picker.messageId;
  privateLog("discord.translate.thread_refused", { status: res?.status ?? 0 });
  return null;
}

/** Each language as the bot's messages in the message's thread; false when that could not be done. */
async function postInThread(
  deps: TranslationDeps,
  job: TranslationJob,
  done: Done[],
  name: string,
): Promise<boolean> {
  if (!job.post || !deps.botToken) return false;
  const threadId = await openThread(deps, job.post, name);
  if (!threadId) return false;
  for (const content of done.flatMap((d) => messagesOf(d.to, d.text))) {
    const sent = await discord(
      deps,
      `/channels/${threadId}/messages`,
      "POST",
      { content, allowed_mentions: NO_PINGS },
      true,
    );
    if (!sent?.ok) {
      privateLog("discord.translate.thread_post_failed", { status: sent?.status ?? 0 });
      return false;
    }
  }
  return true;
}

/** The translations as one public follow-up in the channel, with a link to the message. */
async function postInChannel(deps: TranslationDeps, job: TranslationJob, done: Done[]) {
  const { applicationId, token } = job.webhook;
  const res = await discord(deps, `/webhooks/${applicationId}/${token}`, "POST", {
    content: job.post?.link,
    embeds: done.map(embedOf),
    allowed_mentions: NO_PINGS,
  });
  if (!res?.ok) privateLog("discord.translate.channel_failed", { status: res?.status ?? 0 });
  return res?.ok ?? false;
}

/** "For everyone": the picker steps aside while translating, then says where the post went. */
async function forEveryone(deps: TranslationDeps, ai: ChatModel, job: TranslationJob) {
  const t = WORKSPACE_DICTIONARIES[job.language];
  const post = job.post;
  if (!post) return;
  const again = { components: pickerRows(t, post.picker, post.threads) };
  // The picker loses its buttons first, so a second press cannot post twice.
  await editOwn(deps, job.webhook, { content: t["translate.discord.working"], components: [] });
  const { done, failure } = await translateAll(ai, job);
  if (done.length === 0) {
    const content = failure ? failureLine(t, failure) : t["translate.discord.nothing"];
    await editOwn(deps, job.webhook, failure ? { content, ...again } : { content, embeds: [] });
    return;
  }
  const inThread =
    post.where === "thread" && (await postInThread(deps, job, done, t["translate.discord.thread"]));
  const where = inThread ? "thread" : "channel";
  if (!inThread && !(await postInChannel(deps, job, done))) {
    await editOwn(deps, job.webhook, { content: t["translate.discord.failed"], ...again });
    return;
  }
  privateLog(`discord.translate.${where}`, { languages: done.length });
  const line = inThread
    ? t["translate.discord.postedThread"]
    : post.where === "thread"
      ? t["translate.discord.noThread"]
      : t["translate.discord.posted"];
  await editOwn(deps, job.webhook, { content: line, embeds: [], components: [] });
}

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
