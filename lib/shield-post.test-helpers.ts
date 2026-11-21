// A webhook a workspace saved in Alliance settings → Discord, sealed as D129 stores it, for the Raid Shield
// summary's tests (D147: the summary posts only through the saved Raid Shield channel).
import type { Db } from "./db";
import { storeWebhook } from "./repo/workspace-discord";
import { sealKey } from "./workspace-keys";

/** The master key the tests seal and open webhooks with; invented. */
export const HOOK_SECRET = Buffer.alloc(32, 5).toString("base64");

export async function saveHook(
  db: Db,
  ws: number,
  hook: { channel: "leaders" | "shield"; url: string; forum?: boolean; secret?: string },
) {
  const { channel, url, forum = false, secret = HOOK_SECRET } = hook;
  const { ciphertext, nonce, masterFp } = sealKey(secret, ws, url, `webhook-${channel}`);
  await storeWebhook(db, {
    ...{ workspaceId: ws, channel, ciphertext, nonce, masterFp, name: channel, forum },
    ...{ savedBy: null, savedAt: new Date("2026-11-20T12:00:00Z"), requestId: `${channel}-save` },
  });
}
