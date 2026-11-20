// Discord OAuth for the workspace (D71): two fetch calls after the code exchange, no bot, no dependency.
// The API base comes from DISCORD_API_BASE_URL (default https://discord.com/api), so tests and the local
// e2e point it at a stub (D73). Discord's answers are parsed at this boundary; tokens are never stored.
import { z } from "zod";

import type { Env } from "../env";

export const SCOPES = "identify guilds.members.read";
const TIMEOUT_MS = 10_000;

export interface DiscordConfig {
  clientId: string;
  clientSecret: string;
  baseUrl: string;
}

/** null while DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET is unset: the app runs, sign-in is off. */
export function discordConfig(env: Env): DiscordConfig | null {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return null;
  return {
    clientId: env.DISCORD_CLIENT_ID,
    clientSecret: env.DISCORD_CLIENT_SECRET,
    baseUrl: env.DISCORD_API_BASE_URL.replace(/\/$/, ""),
  };
}

/** `silent`: prompt=none, the re-authorisation after 24 hours that asks the officer nothing. */
export function authorizeUrl(
  config: DiscordConfig,
  redirectUri: string,
  state: string,
  silent: boolean,
  scope: string = SCOPES,
): string {
  const query = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope,
    state,
    prompt: silent ? "none" : "consent",
  });
  return `${config.baseUrl}/oauth2/authorize?${query}`;
}

const tokenSchema = z.object({ access_token: z.string().min(1) });
/** Who the account is: its id and the name to show (Discord's display name, else its username). */
export const userSchema = z
  .object({
    id: z.string().regex(/^\d{1,20}$/),
    username: z.string(),
    global_name: z.string().nullish(),
  })
  .transform((u) => ({ id: u.id, name: u.global_name ?? u.username }));
const memberSchema = z.object({ nick: z.string().nullish(), roles: z.array(z.string()) });

export type DiscordMember =
  | {
      ok: true;
      userId: string;
      displayName: string;
      /** null: the account is not in the workspace's Discord server. */
      roles: string[] | null;
    }
  | { ok: false; code: "discord_token" | "discord_user" | "discord_member" };

const NOT_FOUND = Symbol("404");

/** A 2xx answer's JSON; NOT_FOUND for a 404; null for any other status, a timeout or a network error. */
export async function readJson(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<unknown> {
  try {
    const res = await fetcher(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 404) return NOT_FOUND;
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/** The code exchange, then who the account is and its roles in `guildId`. Each step has its own code. */
export async function readMember(
  fetcher: typeof fetch,
  config: DiscordConfig,
  code: string,
  redirectUri: string,
  guildId: string,
): Promise<DiscordMember> {
  const get = await exchangeCode(fetcher, config, code, redirectUri);
  if (!get) return { ok: false, code: "discord_token" };
  const user = userSchema.safeParse(await get("/users/@me"));
  if (!user.success) return { ok: false, code: "discord_user" };

  const body = await get(`/users/@me/guilds/${encodeURIComponent(guildId)}/member`);
  const name = user.data.name;
  // Discord answers 404 (Unknown Guild) when the account is not in the server.
  if (body === NOT_FOUND) return { ok: true, userId: user.data.id, displayName: name, roles: null };
  const member = memberSchema.safeParse(body);
  if (!member.success) return { ok: false, code: "discord_member" };
  return {
    ok: true,
    userId: user.data.id,
    displayName: member.data.nick ?? name,
    roles: member.data.roles,
  };
}

/**
 * The code exchange: a reader of Discord paths with the account's token, or null when Discord refused the
 * code. The token serves this request only and is never stored.
 */
export async function exchangeCode(
  fetcher: typeof fetch,
  config: DiscordConfig,
  code: string,
  redirectUri: string,
): Promise<((path: string) => Promise<unknown>) | null> {
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const token = tokenSchema.safeParse(
    await readJson(fetcher, `${config.baseUrl}/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    }),
  );
  if (!token.success) return null;
  return (path: string) =>
    readJson(fetcher, `${config.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${token.data.access_token}` },
    });
}
