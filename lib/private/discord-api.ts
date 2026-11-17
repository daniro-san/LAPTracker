// Discord's interaction numbers, the permission bits read here, and the one call that edits an
// interaction's own message: shared by the screenshot import (D96) and the Translate commands (D101).

/** Interaction types. */
export const PING = 1;
export const APPLICATION_COMMAND = 2;
export const MESSAGE_COMPONENT = 3;
/** Response types. */
export const PONG = 1;
export const REPLY = 4;
export const DEFERRED_REPLY = 5;
export const UPDATE = 7;
/** A message only the person who used the command sees. */
export const EPHEMERAL = 64;

/** Permission bits, as Discord resolves them for the channel in `member.permissions`. */
export const SEND_MESSAGES = 1n << 11n;
export const CREATE_PUBLIC_THREADS = 1n << 35n;
export const SEND_MESSAGES_IN_THREADS = 1n << 38n;

/** The interaction's webhook: application id and token. */
export interface Webhook {
  applicationId: string;
  token: string;
}

const TIMEOUT_MS = 10_000;

/** Edits the interaction's first answer with `message`, mentions off; null on a network error or timeout. */
export function editOriginal(
  fetcher: typeof fetch,
  discordBase: string,
  webhook: Webhook,
  message: object,
): Promise<Response | null> {
  const { applicationId, token } = webhook;
  const url = `${discordBase.replace(/\/$/, "")}/webhooks/${applicationId}/${token}/messages/@original`;
  return fetcher(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...message, allowed_mentions: { parse: [] } }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);
}
