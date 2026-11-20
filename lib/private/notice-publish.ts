// "Publish to Discord" (issue 345, D102): posts a notice, in the languages the officer chose, to the
// channel its audience names: a members notice to the members' channel, a leadership one to the leaders'.
// The channels are the workspace's own, saved in Alliance settings (D129), or WORKSPACE_DISCORD_WEBHOOKS
// until it saves one. Never guessed, never hard-coded. Once per request id (D100): the claim
// comes before the first post. `allowed_mentions` is empty on every message, so a notice never pings
// anyone. The log carries codes and numbers only; the webhook URL never leaves this module but in the
// request to Discord.
import { z } from "zod";

import type { Db } from "../db";
import { pictureBytes } from "../repo/notice-pictures";
import { claimPublish, finishPublish, lastPosted, type PublishRow } from "../repo/notice-publishes";
import type { WorkspaceAccess } from "./access";
import { featureOn } from "./features";
import { privateLog } from "./log";
import { discordMessages, threadName } from "./notice-formats";
import { bodyOf, type PostedPicture } from "./notice-publish-body";
import { NOTICE_LANGUAGES, type NoticeLanguage } from "./notice-rules";
import { noticeDetail } from "./notices";

const SEND_TIMEOUT_MS = 5_000;
/** All the messages of one publish; the route's maxDuration (60 s) leaves room for the reads and writes. */
const BUDGET_MS = 40_000;
/** A claim still "posting" after this long was left by a run that died: it counts as failed. */
export const STUCK_MS = 120_000;

export type Audience = "members" | "leaders";
export interface Channel {
  url: string;
  name: string;
  forum: boolean;
}
/** The workspace's two notice channels (discord-webhooks.ts `noticeChannels`); null where none is set up. */
export type Channels = Record<Audience, Channel | null>;

export const audienceOf = (forMembers: boolean): Audience => (forMembers ? "members" : "leaders");

/** The publish sheet's request: the notice, the languages in the order shown, and its request id. */
export const publishInput = z
  .object({
    id: z.number().int().positive(),
    languages: z.array(z.enum(NOTICE_LANGUAGES)).min(1).max(NOTICE_LANGUAGES.length),
    requestId: z.uuid(),
  })
  .strict()
  .refine((p) => new Set(p.languages).size === p.languages.length);
export type PublishInput = z.infer<typeof publishInput>;

export type PublishResult =
  | { ok: true; row: PublishRow }
  | {
      ok: false;
      code: "not_found" | "not_set_up" | "no_text" | "posting" | "recent" | "failed";
    };

export interface PublishDeps {
  fetch: typeof fetch;
  now: Date;
  channels: Channels;
  /** Each language's name as the post heads it: "English", "Português", "Français". */
  names: Record<NoticeLanguage, string>;
}

/** One message: into the forum post `thread` once it exists; a forum's first message names the post. */
function send(
  doFetch: typeof fetch,
  channel: Channel,
  message: { content: string; picture: PostedPicture | null },
  thread: string | null,
  title: string,
  /** Milliseconds left in the publish's budget. */
  left: number,
) {
  const url = `${channel.url}?wait=true${thread ? `&thread_id=${thread}` : ""}`;
  const opens = channel.forum && thread === null;
  const payload = {
    content: message.content,
    allowed_mentions: { parse: [] },
    ...(opens && { thread_name: threadName(title) }),
  };
  return doFetch(url, {
    method: "POST",
    ...bodyOf(payload, message.picture),
    signal: AbortSignal.timeout(Math.min(SEND_TIMEOUT_MS, left)),
  }).catch(() => null);
}

/**
 * Posts each message in turn; a forum's first one opens the post, the rest go into it. Stops when the
 * budget is spent, which leaves the publish failed. Also posts the weekly thanks (D114). A notice's picture
 * goes with the first message (D119).
 */
export async function postMessages(
  doFetch: typeof fetch,
  channel: Channel,
  title: string,
  messages: string[],
  picture: PostedPicture | null = null,
): Promise<{ sent: number; status: number | null }> {
  const deadline = Date.now() + BUDGET_MS;
  let thread: string | null = null;
  /** Only the first message carries the picture. */
  let attached = picture;
  for (const [i, content] of messages.entries()) {
    const left = deadline - Date.now();
    if (left <= 0) return { sent: i, status: null };
    const res = await send(doFetch, channel, { content, picture: attached }, thread, title, left);
    attached = null;
    if (!res?.ok) return { sent: i, status: res?.status ?? null };
    if (channel.forum && i === 0) {
      const made = (await res.json().catch(() => null)) as { channel_id?: unknown } | null;
      if (typeof made?.channel_id !== "string") return { sent: 1, status: null };
      thread = made.channel_id;
    }
  }
  return { sent: messages.length, status: null };
}

/** An earlier claim of this request id: what it came to. A claim stuck in "posting" counts as failed. */
function earlier(row: PublishRow, id: number, now: Date): PublishResult {
  if (row.noticeId !== id) return { ok: false, code: "not_found" };
  if (row.status === "posted") return { ok: true, row };
  const running = row.status === "posting" && now.getTime() - row.at.getTime() < STUCK_MS;
  return { ok: false, code: running ? "posting" : "failed" };
}

export async function publishNotice(
  db: Db,
  access: WorkspaceAccess,
  input: PublishInput,
  deps: PublishDeps,
): Promise<PublishResult> {
  const notice = await noticeDetail(db, access, input.id);
  if (!notice) return { ok: false, code: "not_found" };
  const audience = audienceOf(notice.forMembers);
  const channel = deps.channels[audience];
  if (!channel) return { ok: false, code: "not_set_up" };
  const languages = input.languages.filter((l) => notice.fields[l].value.trim() !== "");
  if (languages.length === 0) return { ok: false, code: "no_text" };
  // INVARIANT notices.publish-once: a double tap or a retry with the same request id posts nothing more.
  const claim = await claimPublish(db, {
    workspaceId: access.workspaceId,
    noticeId: input.id,
    requestId: input.requestId,
    audience,
    languages,
    userId: access.user.id,
    now: deps.now,
  });
  if (claim.kind === "recent") return { ok: false, code: "recent" };
  if (claim.kind === "earlier") return earlier(claim.row, input.id, deps.now);
  const title = notice.fields.title.value;
  const sections = languages.map((l) => ({ name: deps.names[l], text: notice.fields[l].value }));
  const messages = discordMessages(title, sections, !channel.forum);
  // D126: with notice pictures turned off, the picture stays stored and is not posted.
  const picture = featureOn(access, "notice_pictures")
    ? await pictureBytes(db, access.workspaceId, input.id)
    : null;
  const started = Date.now();
  const { sent, status } = await postMessages(deps.fetch, channel, title, messages, picture);
  const done = sent === messages.length;
  await finishPublish(db, claim.row.id, done ? "posted" : "failed", sent);
  const ms = Date.now() - started;
  if (!done) {
    privateLog("notices.publish.failed", { http: status ?? 0, sent, of: messages.length, ms });
    return { ok: false, code: "failed" };
  }
  const pictures = picture ? 1 : 0;
  privateLog("notices.publish.ok", { messages: sent, languages: languages.length, pictures, ms });
  return { ok: true, row: { ...claim.row, status: "posted" } };
}

/** The newest publish that reached Discord, for the notice page. */
export const lastPublish = (db: Db, access: WorkspaceAccess, noticeId: number) =>
  lastPosted(db, access.workspaceId, noticeId);
