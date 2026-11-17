// The Discord message command of the screenshot import (D96), as registered in each workspace's server and
// as the interactions route checks it: one definition for both. Type 3 is a message command ("Apps" on a
// message); its name may have capitals and spaces.
import { z } from "zod";

import type { Env } from "./env";

export const IMPORT_COMMAND = { name: "Send to LAPTracker", type: 3 } as const;

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
 * Registers IMPORT_COMMAND in each guild, where the app is installed with `applications.commands`: the
 * app's client-credentials grant (scope `applications.commands.update`), no bot token, then Discord's bulk
 * overwrite (PUT), so each guild's commands become this one. Used by `pnpm discord:register` and /admin.
 */
export async function registerImportCommand(
  env: Pick<Env, "DISCORD_CLIENT_ID" | "DISCORD_CLIENT_SECRET" | "DISCORD_API_BASE_URL">,
  fetcher: typeof fetch,
  guildIds: readonly string[],
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
    guildIds.map(async (guildId) => {
      const res = await send(`/applications/${id}/guilds/${guildId}/commands`, {
        method: "PUT",
        headers: { authorization: `Bearer ${token.bearer}`, "content-type": "application/json" },
        body: JSON.stringify([IMPORT_COMMAND]),
      });
      return { guildId, status: res?.status ?? 0 };
    }),
  );
  return { ok: true, guilds };
}
