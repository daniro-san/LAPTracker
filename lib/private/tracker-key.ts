// The workspace's own tracker key (D124, issue 438), as its officers see and change it in Alliance settings.
// Every function takes a WorkspaceAccess, so the workspace comes from the session, never from a request.
// Saving tests the key with one /quota call on that key only (lib/workspace-keys.ts `checkKey`), then
// stores it sealed. What leaves here is a state, the last 4 characters and the quota left: never the key.
import { z } from "zod";

import { OWN_ALLIANCE_ID } from "../../config/alliances";
import type { Db } from "../db";
import type { Env } from "../env";
import { recordFailure } from "../repo/auth-attempts";
import {
  clearKey,
  dropKeyChange,
  keyFacts,
  recordKeyChange,
  storeKey,
} from "../repo/workspace-keys";
import type { V1Source } from "../sources/types";
import { checkKey, keyUsable, masterFingerprint, sealKey, TRACKER_KEY } from "../workspace-keys";
import type { WorkspaceAccess } from "./access";

/** The route's body: a key to set (or replace), or Remove. The key is checked here, at the boundary. */
export const trackerKeyInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("set"),
      key: z.string().trim().regex(TRACKER_KEY),
      requestId: z.uuid(),
    })
    .strict(),
  z.object({ action: z.literal("remove"), requestId: z.uuid() }).strict(),
]);
export type TrackerKeyInput = z.infer<typeof trackerKeyInput>;

/**
 * off: no WORKSPACE_KEYS_SECRET, so no key can be saved. none: no key. site: no key, and the own alliance's
 * squads read on the site's key meanwhile. ok, invalid, out_of_quota, reenter: the saved key's last status
 * (`out_of_quota` read as ok again after the 00:00 UTC reset). `reenter`: sealed under another master key
 * (its fingerprint is not the current WORKSPACE_KEYS_SECRET's, worked out here and never written), or
 * marked so when it failed to open under its own; it must be pasted again.
 */
export type KeyState = "off" | "none" | "site" | "ok" | "invalid" | "out_of_quota" | "reenter";

export interface TrackerKeyView {
  state: KeyState;
  last4: string | null;
  quotaRemaining: number | null;
  /** When the status was last set; null without a key. */
  checkedAt: Date | null;
}

export async function trackerKeyView(
  db: Db,
  access: WorkspaceAccess,
  env: Pick<Env, "WORKSPACE_KEYS_SECRET">,
  now: Date,
): Promise<TrackerKeyView> {
  const facts = await keyFacts(db, access.workspaceId);
  const site = access.unionId === OWN_ALLIANCE_ID;
  const secret = env.WORKSPACE_KEYS_SECRET;
  if (!secret) return { state: "off", last4: null, quotaRemaining: null, checkedAt: null };
  if (!facts.set) {
    const state = site ? "site" : "none";
    return { state, last4: null, quotaRemaining: null, checkedAt: null };
  }
  // A changed master key shows at once, with no write and no tracker call.
  const sealedElsewhere = facts.masterFp !== masterFingerprint(secret);
  const reset = facts.status === "out_of_quota" && keyUsable(facts.status, facts.statusAt, now);
  const stored = reset ? "ok" : facts.status === "unset" ? "none" : facts.status;
  return {
    state: sealedElsewhere ? "reenter" : stored,
    last4: facts.last4,
    quotaRemaining: reset ? null : facts.quotaRemaining,
    checkedAt: facts.statusAt,
  };
}

/**
 * refused: the tracker answered 401 (the key is wrong); unreachable: no clear answer (a 403, a 5xx, a
 * timeout). Neither stores anything: a key already saved stays. off: no WORKSPACE_KEYS_SECRET.
 * rate_limited: more than KEY_TESTS tests in the window, for this workspace or this officer.
 */
export type SaveResult =
  | { ok: true; view: TrackerKeyView }
  | { ok: false; code: "refused" | "unreachable" | "off" | "rate_limited" };

/**
 * "Test the key" calls the tracker under our User-Agent, so a loop of wrong keys could get the site
 * blocked: at most 5 tests per 15 minutes per workspace and per officer, refused tests included (INVARIANT
 * keys.test-rate-limit, security review 2026-11-19). Counted in auth_attempts, like the PIN (lib/auth.ts).
 */
export const KEY_TESTS = 5;
export const KEY_TEST_WINDOW_MS = 15 * 60_000;

/** Counts this test for the workspace and the officer; false when either is over the limit. */
async function testAllowed(db: Db, access: WorkspaceAccess, now: Date): Promise<boolean> {
  const keys = [`keytest:ws:${access.workspaceId}`, `keytest:user:${access.user.id}`];
  const counts = await Promise.all(
    keys.map((key) => recordFailure(db, key, KEY_TEST_WINDOW_MS, now)),
  );
  return counts.every((n) => n <= KEY_TESTS);
}

/**
 * Set or replace the key. The request id is claimed first (D100): a retry after a lost answer, or a double
 * tap, makes no second /quota call and answers the key as it now stands. A refused or unanswered test
 * frees the id again, so the officer's same form can try once more.
 */
export async function saveTrackerKey(
  db: Db,
  access: WorkspaceAccess,
  deps: { env: Pick<Env, "WORKSPACE_KEYS_SECRET">; v1: Pick<V1Source, "fetchQuota">; now: Date },
  input: Extract<TrackerKeyInput, { action: "set" }>,
): Promise<SaveResult> {
  const { env, now } = deps;
  const secret = env.WORKSPACE_KEYS_SECRET;
  if (!secret) return { ok: false, code: "off" };
  const change = {
    workspaceId: access.workspaceId,
    changedBy: access.user.id,
    changedAt: now,
    requestId: input.requestId,
  };
  if (!(await recordKeyChange(db, { ...change, action: "set" }))) {
    return { ok: true, view: await trackerKeyView(db, access, env, now) };
  }
  // A repeat of a request id never got here, so it is not counted.
  if (!(await testAllowed(db, access, now))) {
    await dropKeyChange(db, access.workspaceId, input.requestId);
    return { ok: false, code: "rate_limited" };
  }
  // INVARIANT keys.test-own-key: the test spends one call of this key's quota, never LAP_API_KEY's.
  const check = await checkKey(deps.v1, input.key);
  if (check.status === "invalid" || check.status === "unreachable") {
    await dropKeyChange(db, access.workspaceId, input.requestId);
    return { ok: false, code: check.status === "invalid" ? "refused" : "unreachable" };
  }
  const sealed = sealKey(secret, access.workspaceId, input.key);
  const status = { status: check.status, quotaRemaining: check.quotaRemaining };
  await storeKey(db, access.workspaceId, sealed, status, now);
  return { ok: true, view: await trackerKeyView(db, access, env, now) };
}

/** Remove: the key is deleted; the workspace's own reads stop (the own alliance's go back to the site's key). */
export async function removeTrackerKey(
  db: Db,
  access: WorkspaceAccess,
  env: Pick<Env, "WORKSPACE_KEYS_SECRET">,
  input: Extract<TrackerKeyInput, { action: "remove" }>,
  now: Date,
): Promise<TrackerKeyView> {
  const change = {
    workspaceId: access.workspaceId,
    action: "removed" as const,
    changedBy: access.user.id,
    changedAt: now,
    requestId: input.requestId,
  };
  if (await recordKeyChange(db, change)) await clearKey(db, access.workspaceId, now);
  return trackerKeyView(db, access, env, now);
}
