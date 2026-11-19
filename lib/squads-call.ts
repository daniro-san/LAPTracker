// One call of the nightly squads read (D117), split from lib/squads-read.ts for size: the call on its
// target's key (D124), what a failure does (one retry for a 5xx or no answer; a 429, or a workspace key's
// 401, ends the day and marks that key), the squads stored and the tracker's "Main squad might" version.
import type { Db } from "./db";
import { factVersion, insertFact } from "./repo/member-facts";
import { latestSquads, storeSquads } from "./repo/squads";
import { markKey } from "./repo/workspace-keys";
import {
  QuotaExhaustedError,
  RequestError,
  UpstreamError,
  type PlayerSquadsInput,
} from "./sources/types";
import { mainSquad, trackerMightWrite } from "./squads";
import type { SquadsDeps } from "./squads-read";
import { forbidden, keyStatusOf, type SquadTarget } from "./workspace-keys";

/** One batch's counts, carried into the day's row. */
export interface Batch {
  calls: number;
  read: number;
  withSquads: number;
  failed: number;
  might: number;
  remaining: number | null;
  afterUid: number | null;
  /** Members to retry once after the pass (a 5xx or no answer). */
  retryUids: number[];
  retried: number;
  stop: string | null;
}

/** A failure worth one more call after the pass: a 5xx, or no answer at all. Never a 429 or another 4xx. */
const retryable = (e: unknown) =>
  e instanceof RequestError || (e instanceof UpstreamError && e.status >= 500);

/** "unsent": the deadline came before the call; "lost": the claim was taken over; "done": go on. */
export type CallOutcome = "unsent" | "lost" | "done";

export type Call = { uid: number; retry: boolean; target: SquadTarget; signal: AbortSignal };

/**
 * One call for one member (the adapter itself never retries it), on the target's key, then the squads
 * stored and the main squad's version when due. In the pass, a 5xx, no answer, or the deadline cutting a
 * call already sent puts the member on the retry list; a retry takes them off it whatever its answer.
 * `save` writes the cursor and the counts under the batch's claim.
 */
export async function readOne(
  deps: SquadsDeps,
  db: Db,
  call: Call,
  b: Batch,
  save: () => Promise<boolean>,
): Promise<CallOutcome> {
  let sent = false;
  const onAttempt = () => {
    sent = true;
    b.calls++;
  };
  const { key, unionId, workspaceId } = call.target;
  let player: PlayerSquadsInput;
  try {
    // INVARIANT keys.own-quota-only: a workspace key's read is sent on that key, never on LAP_API_KEY.
    const options = { maxRetries: 0, ...(key && { apiKey: key.apiKey }) };
    player = await deps.v1.fetchPlayer(call.uid, onAttempt, call.signal, options);
  } catch (e) {
    if (!sent) return "unsent";
    await failedCall(deps, db, e, call, b);
    moveOn(call, b);
    return (await save()) ? "done" : "lost";
  }
  b.remaining = player.quota?.remaining ?? (b.remaining === null ? null : b.remaining - 1);
  b.read++;
  if (player.squads.length > 0) b.withSquads++;
  moveOn(call, b);
  // INVARIANT squads.once-per-member: the cursor and the call are saved as soon as the answer is in, so a
  // function killed while storing never makes the next batch call this member again.
  if (!(await save())) return "lost";
  const now = deps.now();
  await storeSquads(db, unionId, call.uid, player.squads, now);
  if (workspaceId !== null && (await writeMight(db, { workspaceId, unionId }, call.uid, now)))
    b.might++;
  return "done";
}

/** Why a failed call ends the day: a 429, or on a workspace key a 401 or a 403; null: it does not. */
function stopOn(e: unknown, status: string | null, onKey: boolean): string | null {
  if (e instanceof QuotaExhaustedError) return "quota_429";
  if (status === "invalid") return "key_invalid";
  return onKey && forbidden(e) ? "key_forbidden" : null;
}

/**
 * A call that was sent and failed. A 429 ends the day's read: the quota is spent. On a workspace key a 401
 * ends it too, and the key is marked `invalid` (or `out_of_quota` after the 429): that workspace's reads
 * stop until an officer replaces the key or the quota resets, and never go on on our key (D124). A 5xx (5
 * to 6 of 100 members on 2026-11-18), no answer, or the run's deadline cutting the call gets one retry
 * after the pass (owner); if that fails too, the member's stored squads stay as they are until tomorrow.
 * A 403 on a workspace key ends that night's read and leaves the key's status as it is.
 */
async function failedCall(deps: SquadsDeps, db: Db, e: unknown, call: Call, b: Batch) {
  const { key } = call.target;
  const status = key ? keyStatusOf(e) : null;
  if (key && status) {
    const patch = { status, ...(status === "out_of_quota" && { quotaRemaining: 0 }) };
    await markKey(db, key.workspaceId, key.nonce, patch, deps.now());
  }
  const stop = stopOn(e, status, key !== null);
  if (stop) b.stop = stop;
  else b.failed++;
  if (!call.retry && (retryable(e) || call.signal.aborted)) b.retryUids.push(call.uid);
}

/** INVARIANT squads.once-per-member: one call in the pass, at most one retry, whatever the answers. */
function moveOn(call: { uid: number; retry: boolean }, b: Batch): void {
  if (call.retry) {
    b.retryUids = b.retryUids.filter((uid) => uid !== call.uid);
    b.retried++;
  } else b.afterUid = call.uid;
}

/** The tracker's main squad as the next "Main squad might" version, when trackerMightWrite allows it. */
async function writeMight(
  db: Db,
  where: { workspaceId: number; unionId: number },
  uid: number,
  now: Date,
): Promise<boolean> {
  const { workspaceId } = where;
  const main = mainSquad(await latestSquads(db, where.unionId, uid));
  if (!main) return false;
  const newest = await factVersion(db, workspaceId, uid, "squadMight", "newest");
  if (!trackerMightWrite(newest, main)) return false;
  return insertFact(db, {
    workspaceId,
    uid,
    field: "squadMight",
    version: (newest?.version ?? 0) + 1,
    value: main.power,
    source: "tracker",
    writtenBy: null,
    writtenAt: now,
  });
}
