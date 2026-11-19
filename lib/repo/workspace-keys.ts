// workspace_keys and workspace_key_changes (D124): each workspace's own tracker key, encrypted, its status,
// and who changed it. `sealedKeys` is the only read of the ciphertext, for lib/workspace-keys.ts; every
// other read lists its columns and leaves it out.
import { and, eq } from "drizzle-orm";

import type { Db } from "../db";
import { workspaces } from "../schema";
import { workspaceKeyChanges, workspaceKeys, type KeyStatus } from "../schema-keys";

/**
 * What a key's screen, Home and /admin may know: never the key, its ciphertext or its nonce. `masterFp`
 * says which master key sealed it (a truncated HMAC of a fixed label, not a secret), so a reader can show
 * `reenter` for a key the current WORKSPACE_KEYS_SECRET did not seal, without writing anything.
 */
export interface KeyFacts {
  set: boolean;
  masterFp: string | null;
  last4: string | null;
  status: KeyStatus;
  statusAt: Date | null;
  quotaRemaining: number | null;
}

const UNSET: KeyFacts = {
  set: false,
  masterFp: null,
  last4: null,
  status: "unset",
  statusAt: null,
  quotaRemaining: null,
};

const facts = {
  workspaceId: workspaceKeys.workspaceId,
  ciphertext: workspaceKeys.ciphertext,
  masterFp: workspaceKeys.masterFp,
  last4: workspaceKeys.last4,
  status: workspaceKeys.status,
  statusAt: workspaceKeys.statusAt,
  quotaRemaining: workspaceKeys.quotaRemaining,
};

type FactsRow = { [K in keyof typeof facts]: (typeof workspaceKeys.$inferSelect)[K] };

/** `ciphertext` is read only to say whether a key is set; it leaves this module as a boolean. */
const toFacts = (r: FactsRow): KeyFacts => ({
  set: r.ciphertext !== null,
  masterFp: r.masterFp,
  last4: r.last4,
  status: r.status,
  statusAt: r.statusAt,
  quotaRemaining: r.quotaRemaining,
});

export async function keyFacts(db: Db, workspaceId: number): Promise<KeyFacts> {
  const [row] = await db
    .select(facts)
    .from(workspaceKeys)
    .where(eq(workspaceKeys.workspaceId, workspaceId));
  return row ? toFacts(row) : UNSET;
}

/** Every workspace's key facts, by workspace id: /admin's list. */
export async function allKeyFacts(db: Db): Promise<Map<number, KeyFacts>> {
  const rows = await db.select(facts).from(workspaceKeys);
  return new Map(rows.map((r) => [r.workspaceId, toFacts(r)]));
}

export interface SealedKey {
  workspaceId: number;
  slug: string;
  unionId: number;
  ciphertext: string | null;
  nonce: string | null;
  masterFp: string | null;
  status: KeyStatus;
  statusAt: Date | null;
}

/** Every workspace with its alliance and its sealed key (null when none): the squads read's targets. */
export async function sealedKeys(db: Db): Promise<SealedKey[]> {
  const rows = await db
    .select({
      workspaceId: workspaces.id,
      slug: workspaces.slug,
      unionId: workspaces.unionId,
      ciphertext: workspaceKeys.ciphertext,
      nonce: workspaceKeys.nonce,
      masterFp: workspaceKeys.masterFp,
      status: workspaceKeys.status,
      statusAt: workspaceKeys.statusAt,
    })
    .from(workspaces)
    .leftJoin(workspaceKeys, eq(workspaceKeys.workspaceId, workspaces.id))
    .orderBy(workspaces.id);
  return rows.map((r) => ({ ...r, status: r.status ?? "unset" }));
}

/** A new key (or a replaced one) with the status its test gave. */
export async function storeKey(
  db: Db,
  workspaceId: number,
  sealed: { ciphertext: string; nonce: string; masterFp: string; last4: string },
  check: { status: KeyStatus; quotaRemaining: number | null },
  now: Date,
): Promise<void> {
  const values = { ...sealed, ...check, statusAt: now };
  await db
    .insert(workspaceKeys)
    .values({ workspaceId, ...values })
    .onConflictDoUpdate({ target: workspaceKeys.workspaceId, set: values });
}

/** Remove: the ciphertext, nonce and last 4 go; the row stays `unset`. */
export async function clearKey(db: Db, workspaceId: number, now: Date): Promise<void> {
  const values = {
    ciphertext: null,
    nonce: null,
    masterFp: null,
    last4: null,
    status: "unset" as const,
    statusAt: now,
    quotaRemaining: null,
  };
  await db
    .insert(workspaceKeys)
    .values({ workspaceId, ...values })
    .onConflictDoUpdate({ target: workspaceKeys.workspaceId, set: values });
}

/**
 * A read's outcome on the key it used: the status (`invalid` after a 401, `out_of_quota` after a 429 or
 * an empty quota, `ok` otherwise) and the quota left. Only while that same key is stored: a key replaced
 * during the read keeps the status its own test gave.
 */
export async function markKey(
  db: Db,
  workspaceId: number,
  nonce: string,
  patch: { status?: KeyStatus; quotaRemaining?: number | null },
  now: Date,
): Promise<void> {
  await db
    .update(workspaceKeys)
    .set({ ...patch, ...(patch.status && { statusAt: now }) })
    .where(and(eq(workspaceKeys.workspaceId, workspaceId), eq(workspaceKeys.nonce, nonce)));
}

/** Claims one change for its request id, before the key is tested: false when this id was already used. */
export async function recordKeyChange(
  db: Db,
  change: {
    workspaceId: number;
    action: "set" | "removed";
    changedBy: number;
    changedAt: Date;
    requestId: string;
  },
): Promise<boolean> {
  const rows = await db
    .insert(workspaceKeyChanges)
    .values(change)
    .onConflictDoNothing()
    .returning({ id: workspaceKeyChanges.id });
  return rows.length > 0;
}

/** A claimed change whose key the tracker refused or did not answer for: the same request id may try again. */
export async function dropKeyChange(db: Db, workspaceId: number, requestId: string): Promise<void> {
  await db
    .delete(workspaceKeyChanges)
    .where(
      and(
        eq(workspaceKeyChanges.workspaceId, workspaceId),
        eq(workspaceKeyChanges.requestId, requestId),
      ),
    );
}
