// The app's Discord message commands, as registered in each workspace's server and as the interactions
// route checks them: one definition for both. "Send to LAPTracker" is the screenshot import (D96); the two
// Translate commands are D101's. Type 3 is a message command ("Apps" on a message); its name may have
// capitals and spaces. `/join` (issue 868) is a slash command (type 1) with one text option: the game name or
// ID the person types, at most JOIN_TYPED_MAX characters.
import { z } from "zod";

import type { Env } from "./env";
import type { Feature } from "./workspace-features";

export const IMPORT_COMMAND = { name: "Send to LAPTracker", type: 3 } as const;
export const TRANSLATE_FOR_ME = { name: "Translate for me", type: 3 } as const;
export const TRANSLATE_FOR_EVERYONE = { name: "Translate for everyone", type: 3 } as const;

/** The longest game name or ID `/join` takes: longer than any player name. */
export const JOIN_TYPED_MAX = 40;
export const JOIN_OPTION = "player";
export const JOIN_COMMAND = {
  name: "join",
  type: 1,
  description: "Ask your alliance’s officers to let you in: type your name or ID in the game",
  description_localizations: {
    "pt-BR": "Peça aos oficiais da sua aliança para entrar: digite seu nome ou ID no jogo",
    fr: "Demandez aux officiers de votre alliance de vous accepter : tapez votre nom ou ID en jeu",
  },
  options: [
    {
      type: 3,
      name: JOIN_OPTION,
      description: "Your name or ID in the game",
      description_localizations: {
        "pt-BR": "Seu nome ou ID no jogo",
        fr: "Votre nom ou ID en jeu",
      },
      required: true,
      min_length: 1,
      max_length: JOIN_TYPED_MAX,
    },
  ],
} as const;

/** Every command of the app. Discord's PUT replaces a guild's whole set, so they are registered together. */
export const APP_COMMANDS = [
  IMPORT_COMMAND,
  TRANSLATE_FOR_ME,
  TRANSLATE_FOR_EVERYONE,
  JOIN_COMMAND,
] as const;
export type AppCommand = (typeof APP_COMMANDS)[number];

/** The D126 switch behind each command. */
export const COMMAND_FEATURE: Record<AppCommand["name"], Feature> = {
  [IMPORT_COMMAND.name]: "discord_send",
  [TRANSLATE_FOR_ME.name]: "discord_translate_me",
  [TRANSLATE_FOR_EVERYONE.name]: "discord_translate_everyone",
  [JOIN_COMMAND.name]: "discord_join",
};

/**
 * The commands a workspace's server gets: only those whose feature is on (issue 483, D129). A command
 * turned off is not registered at all, so nobody sees it in Discord's Apps menu.
 */
export const commandsFor = (on: ReadonlySet<Feature>): AppCommand[] =>
  APP_COMMANDS.filter((c) => on.has(COMMAND_FEATURE[c.name]));

/** One server and the commands it should have; an empty list removes every command of the app there. */
export interface CommandTarget {
  guildId: string;
  commands: readonly AppCommand[];
}

const TIMEOUT_MS = 10_000;

/** Each guild's HTTP status; 0 is no answer (a network error or the 10 s timeout). Nothing secret. */
export type RegisterResult =
  | { ok: false; code: "no_credentials" }
  | { ok: false; code: "discord_token"; status: number }
  | { ok: true; guilds: { guildId: string; status: number }[] };

type Send = (path: string, init: RequestInit) => Promise<Response | null>;

const tokenSchema = z.object({ access_token: z.string().min(1) });

/** The app's own bearer token (client credentials), or the HTTP status that refused it (0: no answer). */
async function clientToken(
  send: Send,
  id: string,
  secret: string,
): Promise<{ bearer: string } | { status: number }> {
  const res = await send("/oauth2/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "applications.commands.update",
    }),
  });
  const token = res?.ok ? tokenSchema.safeParse(await res.json().catch(() => null)) : null;
  return token?.success ? { bearer: token.data.access_token } : { status: res?.status ?? 0 };
}

/**
 * Registers each target's commands in its guild, where the app is installed with `applications.commands`:
 * the app's client-credentials grant (scope `applications.commands.update`), no bot token, then Discord's
 * bulk overwrite (PUT), so each guild's commands become exactly the target's (none: all removed). Used by
 * `pnpm discord:register`, /admin and Alliance settings (lib/workspace-commands.ts).
 */
export async function registerAppCommands(
  env: Pick<Env, "DISCORD_CLIENT_ID" | "DISCORD_CLIENT_SECRET" | "DISCORD_API_BASE_URL">,
  fetcher: typeof fetch,
  targets: readonly CommandTarget[],
): Promise<RegisterResult> {
  const id = env.DISCORD_CLIENT_ID;
  const secret = env.DISCORD_CLIENT_SECRET;
  if (!id || !secret) return { ok: false, code: "no_credentials" };
  const base = env.DISCORD_API_BASE_URL.replace(/\/$/, "");
  const send: Send = (path, init) =>
    fetcher(`${base}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(
      () => null,
    );

  const token = await clientToken(send, id, secret);
  if ("status" in token) return { ok: false, code: "discord_token", status: token.status };
  const guilds = await Promise.all(
    targets.map(async ({ guildId, commands }) => {
      const res = await send(`/applications/${id}/guilds/${guildId}/commands`, {
        method: "PUT",
        headers: { authorization: `Bearer ${token.bearer}`, "content-type": "application/json" },
        body: JSON.stringify(commands),
      });
      return { guildId, status: res?.status ?? 0 };
    }),
  );
  return { ok: true, guilds };
}
