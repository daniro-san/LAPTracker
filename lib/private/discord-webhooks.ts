// The workspace's two notice channels (D129, issue 451; D102): officers paste each channel's webhook in Alliance
// settings. The server checks it with one GET to the webhook (Discord answers its server and channel and posts
// nothing) and refuses one from another server than the workspace's. It is stored sealed like D124's key, under
// WORKSPACE_KEYS_SECRET with the workspace and the channel as associated data, and opened only here, at call
// time, to post. No answer, page, log or event carries the URL: only the channel name officers gave.
// WORKSPACE_DISCORD_WEBHOOKS stays the fallback for a channel the workspace has not saved yet.
import { z } from "zod";

import type { Db } from "../db";
import type { Env } from "../env";
import { recordFailure } from "../repo/auth-attempts";
import {
  deleteWebhook,
  sealedWebhooks,
  storeWebhook,
  webhookFacts,
  type WebhookFacts,
} from "../repo/workspace-discord";
import { findWorkspaceBySlug } from "../repo/workspaces";
import { WEBHOOK_CHANNELS, type WebhookChannel } from "../schema-discord";
import { masterFingerprint, openKey, sealKey } from "../workspace-keys";
import type { WorkspaceAccess } from "./access";
import { privateLog } from "./log";
import { postMessages, type Channel, type Channels } from "./notice-publish";

/** A webhook as Discord's "Copy Webhook URL" gives it; the only shape the server accepts. */
export const WEBHOOK_URL =
  /^https:\/\/(?:discord|discordapp)\.com\/api\/webhooks\/(\d{17,20})\/([A-Za-z0-9_-]{20,128})$/;

/** At most 10 saves and 5 test messages per 15 minutes per workspace, refused ones included. */
export const SAVES = 10;
export const TESTS = 5;
export const WINDOW_MS = 15 * 60_000;
const TIMEOUT_MS = 10_000;

const channel = z.enum(WEBHOOK_CHANNELS);

/** The Discord section's requests, checked at the boundary. */
export const discordInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check") }).strict(),
  z
    .object({
      action: z.literal("webhook"),
      channel,
      url: z.string().trim().regex(WEBHOOK_URL),
      name: z
        .string()
        .trim()
        .transform((s) => s.replace(/^#+/, "").trim())
        .pipe(z.string().min(1).max(100)),
      forum: z.boolean(),
      requestId: z.uuid(),
    })
    .strict(),
  z.object({ action: z.literal("remove_webhook"), channel }).strict(),
  z.object({ action: z.literal("test"), channel }).strict(),
]);
export type DiscordInput = z.infer<typeof discordInput>;

const purpose = (c: WebhookChannel) => `webhook-${c}`;

type Secret = Pick<Env, "WORKSPACE_KEYS_SECRET" | "WORKSPACE_DISCORD_WEBHOOKS">;
type Workspace = { workspaceId: number; slug: string };

/**
 * set: saved here and readable. reenter: saved under another master key, so it must be pasted again (no
 * fallback). site: none saved, the site's WORKSPACE_DISCORD_WEBHOOKS has one. none: no channel.
 */
export type WebhookState = "set" | "reenter" | "site" | "none";

export interface WebhookView {
  channel: WebhookChannel;
  state: WebhookState;
  name: string | null;
  forum: boolean;
  savedAt: Date | null;
}

function viewOf(env: Secret, slug: string, c: WebhookChannel, row?: WebhookFacts): WebhookView {
  const usable = row && env.WORKSPACE_KEYS_SECRET;
  if (usable && row.masterFp === masterFingerprint(env.WORKSPACE_KEYS_SECRET as string)) {
    return { channel: c, state: "set", name: row.name, forum: row.forum, savedAt: row.savedAt };
  }
  if (usable)
    return { channel: c, state: "reenter", name: row.name, forum: row.forum, savedAt: null };
  const site = env.WORKSPACE_DISCORD_WEBHOOKS?.[slug]?.[c];
  if (site) return { channel: c, state: "site", name: site.name, forum: site.forum, savedAt: null };
  return { channel: c, state: "none", name: null, forum: false, savedAt: null };
}

/** Each channel's state and name, never its URL: for Alliance settings and the pages that name a channel. */
export async function webhookViews(db: Db, ws: Workspace, env: Secret): Promise<WebhookView[]> {
  const rows = await webhookFacts(db, ws.workspaceId);
  return WEBHOOK_CHANNELS.map((c) =>
    viewOf(
      env,
      ws.slug,
      c,
      rows.find((r) => r.channel === c),
    ),
  );
}

/** The channels' names as the pages show them ("Post to #notices?"); null where nothing can post. */
export async function channelNames(db: Db, ws: Workspace, env: Secret) {
  const views = await webhookViews(db, ws, env);
  const name = (c: WebhookChannel) => {
    const v = views.find((x) => x.channel === c);
    return v && (v.state === "set" || v.state === "site") ? v.name : null;
  };
  return { members: name("members"), leaders: name("leaders") };
}

/** The channels to post to, their webhooks opened for this call only; null where none is usable. */
export async function noticeChannels(db: Db, ws: Workspace, env: Secret): Promise<Channels> {
  const rows = await sealedWebhooks(db, ws.workspaceId);
  const one = (c: WebhookChannel): Channel | null => {
    const row = rows.find((r) => r.channel === c);
    const view = viewOf(env, ws.slug, c, row);
    if (view.state === "site") return env.WORKSPACE_DISCORD_WEBHOOKS?.[ws.slug]?.[c] ?? null;
    if (view.state !== "set" || !row || !env.WORKSPACE_KEYS_SECRET) return null;
    try {
      const url = openKey(env.WORKSPACE_KEYS_SECRET, ws.workspaceId, row, purpose(c));
      return { url, name: row.name, forum: row.forum };
    } catch {
      return null;
    }
  };
  return { members: one("members"), leaders: one("leaders") };
}

export type WebhookResult =
  | { ok: true; views: WebhookView[] }
  | {
      ok: false;
      code: "off" | "rate_limited" | "refused" | "wrong_server" | "unreachable";
    };

type Deps = { env: Secret & Pick<Env, "DISCORD_API_BASE_URL">; fetch: typeof fetch; now: Date };

/** Discord's answer about a webhook: its server, or why there is none. Posts nothing. */
async function webhookGuild(deps: Deps, url: string): Promise<string | "refused" | "unreachable"> {
  const [, id, token] = WEBHOOK_URL.exec(url) ?? [];
  const base = deps.env.DISCORD_API_BASE_URL.replace(/\/$/, "");
  const res = await deps
    .fetch(`${base}/webhooks/${id}/${token}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    .catch(() => null);
  if (res && [401, 403, 404].includes(res.status)) return "refused";
  const body = res?.ok ? ((await res.json().catch(() => null)) as { guild_id?: unknown }) : null;
  return typeof body?.guild_id === "string" ? body.guild_id : "unreachable";
}

/** Save or replace one channel's webhook, after Discord confirms it belongs to the workspace's server. */
export async function saveWebhook(
  db: Db,
  access: WorkspaceAccess,
  deps: Deps,
  input: Extract<DiscordInput, { action: "webhook" }>,
): Promise<WebhookResult> {
  const secret = deps.env.WORKSPACE_KEYS_SECRET;
  if (!secret) return { ok: false, code: "off" };
  // D100: a repeat of a save that went through answers as things stand, with no second check.
  const saved = await webhookFacts(db, access.workspaceId);
  if (saved.some((r) => r.channel === input.channel && r.requestId === input.requestId)) {
    return { ok: true, views: await webhookViews(db, access, deps.env) };
  }
  const tries = await recordFailure(db, `webhook:ws:${access.workspaceId}`, WINDOW_MS, deps.now);
  if (tries > SAVES) return { ok: false, code: "rate_limited" };
  const [guild, workspace] = await Promise.all([
    webhookGuild(deps, input.url),
    findWorkspaceBySlug(db, access.slug),
  ]);
  if (guild === "refused" || guild === "unreachable") return { ok: false, code: guild };
  // INVARIANT discord.own-server: a webhook of another server is never stored (D126: one server each).
  if (guild !== workspace?.discordGuildId) return { ok: false, code: "wrong_server" };
  const sealed = sealKey(secret, access.workspaceId, input.url, purpose(input.channel));
  await storeWebhook(db, {
    workspaceId: access.workspaceId,
    channel: input.channel,
    ciphertext: sealed.ciphertext,
    nonce: sealed.nonce,
    masterFp: sealed.masterFp,
    name: input.name,
    forum: input.forum,
    savedBy: access.user.id,
    savedAt: deps.now,
    requestId: input.requestId,
  });
  return { ok: true, views: await webhookViews(db, access, deps.env) };
}

/** Remove: the channel falls back to the site's WORKSPACE_DISCORD_WEBHOOKS, if it has one, else none. */
export async function removeWebhook(
  db: Db,
  access: WorkspaceAccess,
  env: Secret,
  c: WebhookChannel,
): Promise<WebhookView[]> {
  await deleteWebhook(db, access.workspaceId, c);
  return webhookViews(db, access, env);
}

export type TestResult =
  { ok: true } | { ok: false; code: "rate_limited" | "not_set_up" | "failed" };

/** "Send a test message": one short message to the channel, pinging no one. */
export async function testWebhook(
  db: Db,
  access: WorkspaceAccess,
  deps: Deps & { title: string; text: string },
  c: WebhookChannel,
): Promise<TestResult> {
  const tries = await recordFailure(
    db,
    `webhooktest:ws:${access.workspaceId}`,
    WINDOW_MS,
    deps.now,
  );
  if (tries > TESTS) return { ok: false, code: "rate_limited" };
  const target = (await noticeChannels(db, access, deps.env))[c];
  if (!target) return { ok: false, code: "not_set_up" };
  const { sent, status } = await postMessages(deps.fetch, target, deps.title, [deps.text]);
  privateLog("discord.webhook.test", { sent, http: status ?? 0 });
  return sent === 1 ? { ok: true } : { ok: false, code: "failed" };
}
