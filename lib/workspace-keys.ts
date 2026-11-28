// Each workspace's own tracker key (D124, issue 438): sealed with AES-256-GCM under WORKSPACE_KEYS_SECRET
// (a random 12-byte nonce per write, the workspace id as associated data, so a row copied to another
// workspace does not open), opened only here and only at call time. The key is never logged, returned or
// stored in the clear; what leaves this module is a status, a quota count and the last 4 characters.
// Which reads use which key: `squadTargets`. The own alliance (OWN_ALLIANCE_ID) reads on LAP_API_KEY until
// its officers save a key of their own; any other workspace reads only on its own key, never on ours. A saved
// key that is LAP_API_KEY itself (issue 855, `isSiteKey`) reads as the site's key: `key: null` in a target.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import type { Db } from "./db";
import { allianceLabels, trackedAllianceIds, trackedSetOf } from "./repo/alliances";
import { allSettings } from "./repo/workspace-features";
import { markKey, sealedKeys, type SealedKey } from "./repo/workspace-keys";
import type { KeyStatus } from "./schema-keys";
import { QuotaExhaustedError, UpstreamError, type V1Source } from "./sources/types";
import { resolveFeatures } from "./workspace-features";

/**
 * A tracker key as the site issues it: `lap_` and 43 characters today (measured on our own key by length
 * only, 2026-11-19). The 32 minimum keeps the 4 shown characters a small part of it; lib/redact.ts masks
 * this shape everywhere.
 */
export const TRACKER_KEY = /^lap_[A-Za-z0-9_-]{32,128}$/;

const ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

/**
 * The associated data: what the secret is for and whose it is. A tracker key is `workspace-key`; a webhook
 * is `webhook-leaders` or `webhook-members` (D129), so a sealed value opens only in its own row and place.
 */
const aad = (workspaceId: number, purpose: string) =>
  Buffer.from(`laptracker/${purpose}/${workspaceId}`);
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
  purpose = "workspace-key",
): Sealed & { masterFp: string; last4: string } {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, masterKey(secret), nonce, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad(workspaceId, purpose));
  const body = Buffer.concat([cipher.update(key, "utf8"), cipher.final(), cipher.getAuthTag()]);
  return {
    ciphertext: body.toString("base64"),
    nonce: nonce.toString("base64"),
    masterFp: masterFingerprint(secret),
    last4: key.slice(-4),
  };
}

/** The key, or a throw when the master key, the workspace or the bytes are not the ones it was sealed with. */
export function openKey(
  secret: string,
  workspaceId: number,
  sealed: Sealed,
  purpose = "workspace-key",
): string {
  const body = Buffer.from(sealed.ciphertext, "base64");
  const decipher = createDecipheriv(
    ALGORITHM,
    masterKey(secret),
    Buffer.from(sealed.nonce, "base64"),
    { authTagLength: TAG_BYTES },
  );
  decipher.setAAD(aad(workspaceId, purpose));
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

/**
 * Issue 855: whether an opened key is LAP_API_KEY itself. Compared in constant time on SHA-256 digests (two
 * equal-length buffers, so neither the length nor the content leaks timing); neither key is logged, returned
 * or stored. A target on such a key gets `key: null`: the site key's reserve, event pause and one quota.
 */
export function isSiteKey(apiKey: string): boolean {
  const site = process.env.LAP_API_KEY;
  if (!site) return false;
  const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(digest(apiKey), digest(site));
}

/**
 * Whether the workspace's saved key is LAP_API_KEY (issue 855), for Alliance settings' line: opened under the
 * current master key whatever its status, and only a boolean leaves. False with none saved, the keys off, or
 * a key that does not open here.
 */
export async function savedIsSiteKey(
  db: Db,
  secret: string | undefined,
  workspaceId: number,
): Promise<boolean> {
  const r = (await sealedKeys(db)).find((k) => k.workspaceId === workspaceId);
  if (!secret || !r?.ciphertext || !r.nonce || r.masterFp !== masterFingerprint(secret))
    return false;
  try {
    return isSiteKey(openKey(secret, workspaceId, { ciphertext: r.ciphertext, nonce: r.nonce }));
  } catch {
    return false;
  }
}

/** A workspace key opened for one run: the key itself, and its nonce to mark the same stored key after. */
export interface OpenKey {
  workspaceId: number;
  apiKey: string;
  nonce: string;
}

/**
 * One alliance's squads read and the key it spends: `key` null is LAP_API_KEY, for OWN_ALLIANCE_ID (D117,
 * until its officers save their own key) and for a saved key that is LAP_API_KEY itself (issue 855). `workspaceId` null: the own alliance has no workspace.
 */
export interface SquadTarget {
  unionId: number;
  workspaceId: number | null;
  /** The workspace's slug and its alliance's label, for the run's log lines (issue 452, D133). */
  slug: string;
  alliance?: { tag: string | null } | null;
  key: OpenKey | null;
}

/**
 * A stored key opened for today's read, or null: none, not usable now, or sealed under another master key
 * (shown as `reenter`, computed from the fingerprint and never written: a deployment with another secret
 * cannot touch the rows). Only a key that fails to open under its own master key is marked `reenter`.
 */
async function opened(db: Db, secret: string, r: SealedKey, now: Date): Promise<OpenKey | null> {
  if (!r.ciphertext || !r.nonce || !ownKeyReads(stored(r), secret, now)) return null;
  try {
    const apiKey = openKey(secret, r.workspaceId, { ciphertext: r.ciphertext, nonce: r.nonce });
    return { workspaceId: r.workspaceId, apiKey, nonce: r.nonce };
  } catch {
    await markKey(db, r.workspaceId, r.nonce, { status: "reenter" }, now);
    return null;
  }
}

/**
 * One workspace's own saved key opened for one call (the recruit check, issue 833), or null: none saved, the
 * keys off (no WORKSPACE_KEYS_SECRET), or the key cannot read now. Never LAP_API_KEY for a workspace without
 * a saved key, and never another workspace's key (INVARIANT keys.own-quota-only). A saved key may be
 * LAP_API_KEY itself (`isSiteKey`, issue 855): the caller keeps the site's reserve then.
 */
export async function ownKeyOf(
  db: Db,
  secret: string | undefined,
  workspaceId: number,
  now: Date,
): Promise<OpenKey | null> {
  if (!secret) return null;
  const row = (await sealedKeys(db)).find((r) => r.workspaceId === workspaceId);
  return row ? opened(db, secret, row, now) : null;
}

/**
 * The squads reads due at `now`, own alliance first. A workspace without a usable key of its own is not
 * read, except the own alliance's, on LAP_API_KEY, while it has no saved key or the feature is off
 * (no WORKSPACE_KEYS_SECRET). With no workspace of its own (D125: deleted), the own alliance is not read. A key sealed under another master key is skipped and not written. D126: a
 * workspace whose squads read the owner turned off is not read either; its stored squads stay. D137: the
 * Raid Shield check's reads take the workspaces whose `shield_check` is on instead.
 */
export async function squadTargets(
  db: Db,
  secret: string | undefined,
  now: Date,
  feature: "squads" | "shield_check" = "squads",
): Promise<SquadTarget[]> {
  const [targets, settings] = await Promise.all([keyTargets(db, secret, now), allSettings(db)]);
  const off = settings
    .filter((w) => !resolveFeatures(w.settings, []).on.has(feature))
    .map((w) => w.unionId);
  const on = targets.filter((t) => !off.includes(t.unionId));
  const labels = await allianceLabels(
    db,
    on.map((t) => t.unionId),
  );
  return on.map((t) => ({ ...t, alliance: labels.get(t.unionId) ?? null }));
}

/** One alliance of the daily read (D133) and the key it spends: null is LAP_API_KEY. */
export interface DailyTarget {
  unionId: number;
  key: OpenKey | null;
}

/**
 * The daily read's alliances: the tracked set on LAP_API_KEY (D124: a public read), then every workspace's
 * alliance outside it, on its own key when it saved one (INVARIANT keys.own-quota-only). A workspace with no
 * saved key, or with the keys off (no WORKSPACE_KEYS_SECRET), is read on LAP_API_KEY. A saved key that cannot
 * be used now (invalid, out of quota, sealed under another master key) leaves that alliance out: never ours.
 */
export async function dailyTargets(
  db: Db,
  secret: string | undefined,
  now: Date,
  tracked: readonly number[],
): Promise<DailyTarget[]> {
  const targets: DailyTarget[] = tracked.map((unionId) => ({ unionId, key: null }));
  for (const r of await sealedKeys(db)) {
    const rule = dailyKeyRule(stored(r), secret, now, tracked);
    if (rule === "ours" && !tracked.includes(r.unionId))
      targets.push({ unionId: r.unionId, key: null });
    if (rule !== "own" || !secret) continue;
    const key = await opened(db, secret, r, now);
    // Issue 855: a saved key that is LAP_API_KEY counts in the site key's quota check, once.
    if (key) targets.push({ unionId: r.unionId, key: isSiteKey(key.apiKey) ? null : key });
  }
  return targets;
}

/**
 * INVARIANT daily.one-rule (D133): how a workspace's alliance is in the daily read, from its key's stored
 * facts without opening it. "ours": in the tracked set, or no saved key (or the keys off); "own": a usable
 * key sealed under the current master key; "skip": a saved key that cannot be used now (never ours).
 */
export function dailyKeyRule(
  r: StoredKey,
  secret: string | undefined,
  now: Date,
  tracked: readonly number[],
): "ours" | "own" | "skip" {
  if (tracked.includes(r.unionId) || !secret || !r.set) return "ours";
  return ownKeyReads(r, secret, now) ? "own" : "skip";
}

/** A key's stored facts, as the rules read them: whether one is saved, never the key itself. */
export interface StoredKey {
  unionId: number;
  set: boolean;
  masterFp: string | null;
  status: KeyStatus;
  statusAt: Date | null;
}

const stored = (r: SealedKey): StoredKey => ({ ...r, set: r.ciphertext !== null });

/**
 * A saved key reads now: the current master key sealed it, and its status reads (`ok`, or `out_of_quota`
 * from before today's 00:00 UTC reset). A key spent today, refused or sealed elsewhere does not.
 */
function ownKeyReads(r: StoredKey, secret: string, now: Date): boolean {
  return r.masterFp === masterFingerprint(secret) && keyUsable(r.status, r.statusAt, now);
}

/**
 * The alliances the daily read covers on `day`, by the same rule as `dailyTargets` without opening a key:
 * the day's set (else the newest) and every workspace's alliance the rule does not skip. The lookup and
 * its button read this (D133).
 */
export async function dailyIds(
  db: Db,
  day: string,
  secret: string | undefined,
  now: Date,
): Promise<number[]> {
  const [tracked, rows] = await Promise.all([dailyTracked(db, day), sealedKeys(db)]);
  const workspaces = rows.filter((r) => dailyKeyRule(stored(r), secret, now, tracked) !== "skip");
  return [...new Set([...tracked, ...workspaces.map((r) => r.unionId)])];
}

/** The day's tracked set (else the newest): the alliances the daily read covers on LAP_API_KEY (D133). */
export async function dailyTracked(db: Db, day: string): Promise<readonly number[]> {
  const set = await trackedSetOf(db, day);
  return set?.allianceIds ?? trackedAllianceIds(db);
}

/**
 * INVARIANT squads.key-rule (D132, issue 507): whose key reads an alliance's squads, from its key's stored
 * facts without opening it. "site": LAP_API_KEY, for the own alliance only, while it has no saved key or the
 * keys are off (no WORKSPACE_KEYS_SECRET). "own": a saved key that reads now (`ownKeyReads`: a key spent
 * today does not, until the reset). Null: nobody reads them. The squads read (`squadTargets`) and the
 * desk's progress lines (Alliance settings, the read status bar) follow it.
 */
export function squadsKey(
  r: StoredKey,
  secret: string | undefined,
  now: Date,
): "site" | "own" | null {
  if (!secret || !r.set) return r.unionId === OWN_ALLIANCE_ID ? "site" : null;
  return ownKeyReads(r, secret, now) ? "own" : null;
}

async function keyTargets(db: Db, secret: string | undefined, now: Date): Promise<SquadTarget[]> {
  const rows = await sealedKeys(db);
  const own = rows.find((r) => r.unionId === OWN_ALLIANCE_ID);
  const targets: SquadTarget[] = [];
  // D125: without a workspace (none yet, or deleted) the own alliance's squads are not read at all.
  if (own && squadsKey(stored(own), secret, now) === "site") {
    targets.push({
      unionId: OWN_ALLIANCE_ID,
      workspaceId: own.workspaceId,
      slug: own.slug,
      key: null,
    });
  }
  if (!secret) return targets;
  for (const r of rows) {
    if (squadsKey(stored(r), secret, now) !== "own") continue;
    const opens = await opened(db, secret, r, now);
    if (!opens) continue;
    // Issue 855: a saved key that is LAP_API_KEY reads as the site's key: its reserve, its event pause, its
    // one quota count, and a 429 on it marks no workspace key.
    const key = isSiteKey(opens.apiKey) ? null : opens;
    const target = { unionId: r.unionId, workspaceId: r.workspaceId, slug: r.slug, key };
    if (r.unionId === OWN_ALLIANCE_ID) targets.unshift(target);
    else targets.push(target);
  }
  return targets;
}
