// Officers' browser notifications (D148): whether the site can send them, a device's subscription sealed and
// opened, and one notification to a workspace's officers. Only officers of that workspace, each on the
// devices they turned on for that use (lib/repo/push.ts, INVARIANT push.officers-only). A push service's
// 404 or 410 deletes the device. The text is built per device from counts in its own language and shows on
// lock screens: never a name, a uid or a private field. Nothing here fails the caller: sends run after the
// answer or the read (`pushLater`), each with a short timeout, and their log line is counts only.
import { createHash } from "node:crypto";

import { after } from "next/server";

import type { AppContext } from "./app-context";
import { reportError } from "./app-errors";
import { PUSH_WORDS, type PushWords } from "./copy-push";
import type { Db } from "./db";
import type { Env } from "./env";
import { deleteDevices, markDelivered, pushRecipients } from "./repo/push";
import type { PushUse } from "./schema-push";
import { sendPush, type PushSubscriptionJson, type Vapid } from "./web-push";
import { masterFingerprint, openKey, sealKey, type Sealed } from "./workspace-keys";

/** The associated data a subscription is sealed under, with the workspace id (D124's `aad`). */
const PURPOSE = "push-subscription";

type PushEnv = Pick<
  Env,
  "VAPID_PUBLIC_KEY" | "VAPID_PRIVATE_KEY" | "VAPID_SUBJECT" | "WORKSPACE_KEYS_SECRET"
>;

/** The site's VAPID keys and the master key that seals devices; null when any is missing: no push at all. */
export function pushConfig(env: PushEnv): (Vapid & { secret: string }) | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, WORKSPACE_KEYS_SECRET } = env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT || !WORKSPACE_KEYS_SECRET)
    return null;
  return {
    publicKey: VAPID_PUBLIC_KEY,
    privateKey: VAPID_PRIVATE_KEY,
    subject: VAPID_SUBJECT,
    secret: WORKSPACE_KEYS_SECRET,
  };
}

/**
 * sha256 of an endpoint, hex: how a device's row is found without opening it. The URL as parsed (host in
 * lower case, no default port), so one device never gets two rows.
 */
export const endpointHash = (endpoint: string) =>
  createHash("sha256")
    .update(URL.canParse(endpoint) ? new URL(endpoint).href : endpoint)
    .digest("hex");

/** A subscription sealed for one workspace, as `push_subscriptions` stores it. */
export function sealDevice(secret: string, workspaceId: number, sub: PushSubscriptionJson) {
  const { ciphertext, nonce, masterFp } = sealKey(
    secret,
    workspaceId,
    JSON.stringify(sub),
    PURPOSE,
  );
  return { ciphertext, nonce, masterFp };
}

/** The subscription, or null when this master key cannot open it (it was sealed under another). */
function openDevice(secret: string, workspaceId: number, row: Sealed & { masterFp: string }) {
  if (row.masterFp !== masterFingerprint(secret)) return null;
  try {
    return JSON.parse(openKey(secret, workspaceId, row, PURPOSE)) as PushSubscriptionJson;
  } catch {
    return null;
  }
}

/** One notification: what the lock screen shows, the desk page a tap opens, and its tag (a newer one with the
 * same tag replaces it on the device). */
export interface Notice {
  title: string;
  body: string;
  /** A path on this site, under /w/[slug]. */
  url: string;
  tag: string;
}

export interface PushDeps {
  env: PushEnv;
  fetch: typeof fetch;
  now: () => Date;
}

/**
 * Sends `compose`'s notice, in each device's language, to the workspace's officers whose device is on for
 * `use`. Devices the push service says are gone, or that this master key cannot open, are deleted.
 */
export async function notifyOfficers(
  deps: PushDeps,
  db: Db,
  workspaceId: number,
  use: PushUse,
  compose: (w: PushWords) => Notice,
): Promise<{ sent: number; gone: number; failed: number }> {
  const config = pushConfig(deps.env);
  const counts = { sent: 0, gone: 0, failed: 0 };
  if (!config) return counts;
  const now = deps.now();
  const rows = await pushRecipients(db, workspaceId, use, now);
  const results = await Promise.all(
    rows.map(async (row) => {
      const sub = openDevice(config.secret, workspaceId, row);
      if (!sub) return { id: row.id, result: "gone" as const };
      const payload = JSON.stringify(compose(PUSH_WORDS[row.language]));
      return { id: row.id, result: await sendPush(deps.fetch, config, sub, payload, now) };
    }),
  );
  const ids = (r: string) => results.filter((x) => x.result === r).map((x) => x.id);
  await markDelivered(db, ids("ok"), now);
  await deleteDevices(db, workspaceId, ids("gone"));
  counts.sent = ids("ok").length;
  counts.gone = ids("gone").length;
  counts.failed = ids("failed").length;
  if (rows.length > 0) console.info("push.sent", { use, ...counts });
  return counts;
}

/**
 * Runs `work` after the answer on a connection of its own (the request's is closed with the response), or at
 * once where there is no request (a test). A failure is one code-only log line and a handled PostHog exception:
 * it never reaches the caller.
 */
export function pushLater(
  ctx: Pick<AppContext, "openDb" | "env" | "fetch">,
  work: (db: Db) => Promise<unknown>,
) {
  const run = async () => {
    const { db, close } = ctx.openDb();
    try {
      await work(db);
    } catch (error: unknown) {
      console.error("push.failed", { code: error instanceof Error ? error.name : "unknown" });
      reportError(ctx, { route: "lib/push.ts", kind: "push.failed", error });
    } finally {
      await close();
    }
  };
  try {
    after(run);
  } catch {
    void run();
  }
}
