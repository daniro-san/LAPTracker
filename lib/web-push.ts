// The Web Push protocol (D148) on node:crypto, with no dependency: VAPID (RFC 8292) signs a short JWT with the
// site's P-256 key, and the payload is encrypted for the browser's key with ECDH and aes128gcm (RFC 8291,
// RFC 8188). One POST per subscription, with a short timeout; the push service's answer is all we keep. The
// endpoint is the browser's push service, and only the services browsers use are accepted (`pushHost`), so a
// stored endpoint can never point the server at another host.
import {
  createCipheriv,
  createECDH,
  createPrivateKey,
  createSign,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
} from "node:crypto";

/** A browser's subscription as PushSubscription.toJSON() gives it: base64url keys. */
export interface PushSubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** The site's VAPID key pair (base64url: the 65-byte public point, the 32-byte private scalar) and contact. */
export interface Vapid {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/**
 * The push services of Chrome, Edge, Firefox and Safari. A subscription whose endpoint is on none of them is
 * refused when it is saved, so the server only ever posts to these hosts.
 */
export const PUSH_HOSTS = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "notify.windows.com",
  "push.apple.com",
] as const;

/** Whether `endpoint` is an https URL on a known push service (the host or a subdomain), default port. */
export function pushHost(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.port !== "" || url.username || url.password) return false;
  return PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
}

const b64u = (bytes: Buffer) => bytes.toString("base64url");
const fromB64u = (text: string) => Buffer.from(text, "base64url");

/** A fresh VAPID key pair, as the owner pastes it into Vercel (`pnpm push:keys`). */
export function newVapidKeys(): { publicKey: string; privateKey: string } {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = privateKey.export({ format: "jwk" });
  const point = Buffer.concat([Buffer.from([4]), fromB64u(jwk.x ?? ""), fromB64u(jwk.y ?? "")]);
  return { publicKey: b64u(point), privateKey: jwk.d ?? "" };
}

/** The VAPID private key as a KeyObject, from the two base64url halves in the environment. */
function signingKey(v: Vapid) {
  const point = fromB64u(v.publicKey);
  return createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC",
      crv: "P-256",
      x: b64u(point.subarray(1, 33)),
      y: b64u(point.subarray(33, 65)),
      d: v.privateKey,
    },
  });
}

/** VAPID's Authorization header for one push service (RFC 8292): a JWT for its origin, 12 hours. */
export function vapidAuthorization(v: Vapid, endpoint: string, now: Date): string {
  const header = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = {
    aud: new URL(endpoint).origin,
    exp: Math.floor(now.getTime() / 1000) + 12 * 3600,
    sub: v.subject,
  };
  const unsigned = `${header}.${b64u(Buffer.from(JSON.stringify(claims)))}`;
  const signature = createSign("SHA256")
    .update(unsigned)
    .sign({ key: signingKey(v), dsaEncoding: "ieee-p1363" });
  return `vapid t=${unsigned}.${b64u(signature)}, k=${v.publicKey}`;
}

/** One record of 4096 octets holds any payload this site sends (a few hundred bytes). */
const RECORD_SIZE = 4096;

/**
 * The aes128gcm body for one subscription (RFC 8291 §3.4): the header (salt, record size, our ephemeral
 * public key) and one record, the payload then the last-record delimiter 0x02. `salt` and `ephemeral` are
 * for the RFC's test vector only; each send makes fresh ones.
 */
export function encryptPayload(
  sub: PushSubscriptionJson,
  payload: Buffer,
  fixed?: { salt: Buffer; ephemeralPrivate: Buffer },
): Buffer {
  const uaPublic = fromB64u(sub.keys.p256dh);
  const authSecret = fromB64u(sub.keys.auth);
  const ecdh = createECDH("prime256v1");
  if (fixed) ecdh.setPrivateKey(fixed.ephemeralPrivate);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const salt = fixed?.salt ?? randomBytes(16);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, "Content-Encoding: aes128gcm\0", 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, "Content-Encoding: nonce\0", 12));
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const record = Buffer.concat([
    cipher.update(Buffer.concat([payload, Buffer.from([2])])),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  const size = Buffer.alloc(4);
  size.writeUInt32BE(RECORD_SIZE);
  return Buffer.concat([salt, size, Buffer.from([asPublic.length]), asPublic, record]);
}

/** ok: the push service took it; gone: the subscription no longer exists (404, 410); failed: anything else. */
export type SendResult = "ok" | "gone" | "failed";

/** A push service that does not answer within this is a failure, never a wait. */
export const SEND_TIMEOUT_MS = 5000;

/**
 * One push: encrypted, signed, `TTL` 12 hours (a phone that is off gets it when it wakes the same day),
 * normal urgency. Never throws: a timeout or a network error is `failed`.
 */
export async function sendPush(
  fetcher: typeof fetch,
  v: Vapid,
  sub: PushSubscriptionJson,
  payload: string,
  now: Date,
): Promise<SendResult> {
  try {
    const res = await fetcher(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuthorization(v, sub.endpoint, now),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(12 * 3600),
        Urgency: "normal",
      },
      body: new Uint8Array(encryptPayload(sub, Buffer.from(payload, "utf8"))),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (res.status === 404 || res.status === 410) return "gone";
    return res.ok ? "ok" : "failed";
  } catch {
    return "failed";
  }
}
