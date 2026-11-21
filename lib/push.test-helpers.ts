// Test-only (D148): a browser's push subscription whose private key the test holds, so a test reads exactly
// what the server sent (RFC 8291, decrypted here), an environment with the site's push keys, and a push
// service stub that records every push and answers with the status a test picks. No real push service.
import { createDecipheriv, createECDH, hkdfSync, randomBytes } from "node:crypto";

import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { endpointHash, sealDevice } from "./push";
import { saveDevice } from "./repo/push";
import type { PushLanguage, PushUse } from "./schema-push";
import { workspaceSessions } from "./schema-sessions";
import { newVapidKeys, type PushSubscriptionJson } from "./web-push";

/** A session of `tier` signed in at `at`, ending 7 days later (D71), as lib/private/session.ts stores one. */
export async function sessionFor(
  db: Db,
  who: { workspaceId: number; userId: number },
  at: Date,
  tier: "officer" | "member",
) {
  await db.insert(workspaceSessions).values({
    tokenHash: randomBytes(16).toString("hex"),
    workspaceId: who.workspaceId,
    workspaceUserId: who.userId,
    createdAt: at,
    expiresAt: new Date(at.getTime() + 7 * 86_400_000),
    checkedAt: at,
    tier,
  });
}

/** The master key the tests seal devices with; invented. */
export const PUSH_SECRET = Buffer.alloc(32, 7).toString("base64");

/** TEST_ENV with the site's push keys (generated per run) and the master key. */
export const PUSH_ENV = {
  ...TEST_ENV,
  ...(() => {
    const k = newVapidKeys();
    return { VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey };
  })(),
  VAPID_SUBJECT: "mailto:owner@example.test",
  WORKSPACE_KEYS_SECRET: PUSH_SECRET,
};

/** A device: its subscription (on Chrome's push service host) and a reader for what was pushed to it. */
export function browserDevice(name: string) {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  const auth = randomBytes(16);
  const sub: PushSubscriptionJson = {
    endpoint: `https://fcm.googleapis.com/fcm/send/${name}-${randomBytes(6).toString("hex")}`,
    keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: auth.toString("base64url") },
  };
  /** The JSON the server encrypted for this device. */
  const open = (body: Buffer) => {
    const salt = body.subarray(0, 16);
    const idLength = body[20] ?? 0;
    const asPublic = body.subarray(21, 21 + idLength);
    const record = body.subarray(21 + idLength);
    const shared = ecdh.computeSecret(asPublic);
    const info = Buffer.concat([Buffer.from("WebPush: info\0"), ecdh.getPublicKey(), asPublic]);
    const ikm = Buffer.from(hkdfSync("sha256", shared, auth, info, 32));
    const cek = Buffer.from(hkdfSync("sha256", ikm, salt, "Content-Encoding: aes128gcm\0", 16));
    const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, "Content-Encoding: nonce\0", 12));
    const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
    decipher.setAuthTag(record.subarray(record.length - 16));
    const plain = Buffer.concat([decipher.update(record.subarray(0, -16)), decipher.final()]);
    // The last record ends with its delimiter, 0x02.
    return JSON.parse(plain.subarray(0, -1).toString("utf8")) as Record<string, string>;
  };
  return { sub, open };
}
export type Device = ReturnType<typeof browserDevice>;

/** A device saved for an officer, as "Enable on this device" saves it. */
export async function saveTestDevice(
  db: Db,
  o: { workspaceId: number; userId: number; device: Device; uses: PushUse[] },
  language: PushLanguage = "en",
) {
  await saveDevice(db, {
    workspaceId: o.workspaceId,
    workspaceUserId: o.userId,
    endpointHash: endpointHash(o.device.sub.endpoint),
    ...sealDevice(PUSH_SECRET, o.workspaceId, o.device.sub),
    uses: o.uses,
    language,
    createdAt: new Date("2026-11-20T12:00:00Z"),
  });
}

/** The push service: records each push (endpoint and body) and answers `status(endpoint)` (201 by default). */
export function pushService(status: (endpoint: string) => number = () => 201) {
  const pushes: { endpoint: string; body: Buffer }[] = [];
  const fetch: typeof globalThis.fetch = async (url, init) => {
    const endpoint = String(url);
    pushes.push({ endpoint, body: Buffer.from(init?.body as Uint8Array) });
    return new Response(null, { status: status(endpoint) });
  };
  /** What each device received, decrypted, in order. */
  const received = (device: Device) =>
    pushes.filter((p) => p.endpoint === device.sub.endpoint).map((p) => device.open(p.body));
  return { fetch, pushes, received };
}
