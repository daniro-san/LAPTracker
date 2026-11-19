// Each workspace's own tracker key (D124, issue 438): sealed with AES-256-GCM under WORKSPACE_KEYS_SECRET
// (a random 12-byte nonce per write, the workspace id as associated data, so a row copied to another
// workspace does not open), opened only here and only at call time. The key is never logged, returned or
// stored in the clear; what leaves this module is a status, a quota count and the last 4 characters.
// Which reads use which key: `squadTargets`. The own alliance (OWN_ALLIANCE_ID) reads on LAP_API_KEY until
// its officers save a key of their own; any other workspace reads only on its own key, never on ours.
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import type { Db } from "./db";
import { markKey, sealedKeys, type SealedKey } from "./repo/workspace-keys";
import type { KeyStatus } from "./schema-keys";
import { QuotaExhaustedError, UpstreamError, type V1Source } from "./sources/types";

/**
 * A tracker key as the site issues it: `lap_` and 43 characters today (measured on our own key by length
 * only, 2026-11-19). The 32 minimum keeps the 4 shown characters a small part of it; lib/redact.ts masks
 * this shape everywhere.
 */
export const TRACKER_KEY = /^lap_[A-Za-z0-9_-]{32,128}$/;

const ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

const aad = (workspaceId: number) => Buffer.from(`laptracker/workspace-key/${workspaceId}`);
const masterKey = (secret: string) => Buffer.from(secret, "base64");

export interface Sealed {
  ciphertext: string;
  nonce: string;
}

/**
 * Which master key this is, stored beside each sealed key: an HMAC of a fixed label under the secret,
 * truncated to 16 hex characters. It says nothing about the secret or the key.
 */
export const masterFingerprint = (secret: string) =>
  createHmac("sha256", masterKey(secret))
    .update("laptracker/workspace-key/v1")
    .digest("hex")
    .slice(0, 16);

/** The key sealed for one workspace, with its master key's fingerprint and its last 4 characters. */
export function sealKey(
  secret: string,
  workspaceId: number,
  key: string,
): Sealed & { masterFp: string; last4: string } {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, masterKey(secret), nonce, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad(workspaceId));
  const body = Buffer.concat([cipher.update(key, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return {
    ciphertext: body.toString("base64"),
    nonce: nonce.toString("base64"),
    masterFp: masterFingerprint(secret),
    last4: key.slice(-4),
  };
}

/** The key, or a throw when the master key, the workspace or the bytes are not the ones it was sealed with. */
export function openKey(secret: string, workspaceId: number, sealed: Sealed): string {
  const body = Buffer.from(sealed.ciphertext, "base64");
  const decipher = createDecipheriv(
    ALGORITHM,
    masterKey(secret),
    Buffer.from(sealed.nonce, "base64"),
    { authTagLength: TAG_BYTES },
  );
  decipher.setAAD(aad(workspaceId));
  decipher.setAuthTag(body.subarray(body.length - TAG_BYTES));
  return Buffer.concat([
    decipher.update(body.subarray(0, body.length - TAG_BYTES)),
    decipher.final(),
  ]).toString("utf8");
}

/** The tracker's quota day starts at 00:00 UTC (D117). */
const quotaDayStart = (now: Date) => new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);

/**
 * Whether a stored key may be used at `now`: `ok`, or `out_of_quota` set before today's 00:00 UTC reset.
 * `invalid` and `reenter` stay until an officer saves a key again.
 */
export function keyUsable(status: KeyStatus, statusAt: Date | null, now: Date): boolean {
  if (status === "ok") return true;
  return status === "out_of_quota" && statusAt !== null && statusAt < quotaDayStart(now);
}

/**
 * What a failed call says about the key that made it: a 401 is `invalid`, a 429 `out_of_quota`; anything
 * else (a 403, a 5xx, no answer) says nothing about the key. A 403 stops the night's read without marking
 * the key (security review, 2026-11-19).
 */
export function keyStatusOf(e: unknown): "invalid" | "out_of_quota" | null {
  if (e instanceof QuotaExhaustedError) return "out_of_quota";
  if (e instanceof UpstreamError && e.status === 401) return "invalid";
  return null;
}

/** A 403 on a workspace key: that night's read stops, and the key keeps its status. */
export const forbidden = (e: unknown) => e instanceof UpstreamError && e.status === 403;

export type KeyCheck =
  | { status: "ok" | "out_of_quota"; quotaRemaining: number }
  | { status: "invalid" | "unreachable"; quotaRemaining: null };

/**
 * "Test the key": one /quota call on `apiKey` only, sent once (no retry). Never on LAP_API_KEY: the key is
 * required here, and the adapter uses it in place of ours.
 */
export async function checkKey(
  v1: Pick<V1Source, "fetchQuota">,
  apiKey: string,
): Promise<KeyCheck> {
  try {
    const quota = await v1.fetchQuota(undefined, undefined, { apiKey, maxRetries: 0 });
    const status = quota.remaining > 0 ? "ok" : "out_of_quota";
    return { status, quotaRemaining: quota.remaining };
  } catch (e) {
    const status = keyStatusOf(e);
    if (status === "out_of_quota") return { status, quotaRemaining: 0 };
    return { status: status ?? "unreachable", quotaRemaining: null };
  }
}

/** A workspace key opened for one run: the key itself, and its nonce to mark the same stored key after. */
export interface OpenKey {
  workspaceId: number;
  apiKey: string;
  nonce: string;
}

/**
 * One alliance's squads read and the key it spends: `key` null is LAP_API_KEY, for OWN_ALLIANCE_ID only
 * (D117, until its officers save their own key). `workspaceId` null: the own alliance has no workspace.
 */
export interface SquadTarget {
  unionId: number;
  workspaceId: number | null;
  key: OpenKey | null;
}

/**
 * A stored key opened for today's read, or null: none, not usable now, or sealed under another master key
 * (shown as `reenter`, computed from the fingerprint and never written: a deployment with another secret
 * cannot touch the rows). Only a key that fails to open under its own master key is marked `reenter`.
 */
async function opened(db: Db, secret: string, r: SealedKey, now: Date): Promise<OpenKey | null> {
  if (!r.ciphertext || !r.nonce || r.masterFp !== masterFingerprint(secret)) return null;
  if (!keyUsable(r.status, r.statusAt, now)) return null;
  try {
    const apiKey = openKey(secret, r.workspaceId, { ciphertext: r.ciphertext, nonce: r.nonce });
    return { workspaceId: r.workspaceId, apiKey, nonce: r.nonce };
  } catch {
    await markKey(db, r.workspaceId, r.nonce, { status: "reenter" }, now);
    return null;
  }
}

/**
 * The squads reads due at `now`, own alliance first. A workspace without a usable key of its own is not
 * read, except the own alliance's, on LAP_API_KEY, while it has no saved key or the feature is off
 * (no WORKSPACE_KEYS_SECRET). With no workspace of its own (D125: deleted), the own alliance is not read. A key sealed under another master key is skipped and not written.
 */
export async function squadTargets(
  db: Db,
  secret: string | undefined,
  now: Date,
): Promise<SquadTarget[]> {
  const rows = await sealedKeys(db);
  const own = rows.find((r) => r.unionId === OWN_ALLIANCE_ID);
  const targets: SquadTarget[] = [];
  // D125: without a workspace (none yet, or deleted) the own alliance's squads are not read at all.
  if (own && (!secret || !own.ciphertext)) {
    targets.push({ unionId: OWN_ALLIANCE_ID, workspaceId: own.workspaceId, key: null });
  }
  if (!secret) return targets;
  for (const r of rows) {
    const key = await opened(db, secret, r, now);
    if (!key) continue;
    const target = { unionId: r.unionId, workspaceId: r.workspaceId, key };
    if (r.unionId === OWN_ALLIANCE_ID) targets.unshift(target);
    else targets.push(target);
  }
  return targets;
}
