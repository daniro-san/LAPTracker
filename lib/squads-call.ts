// One call of the squads read (D117, D132), split from lib/squads-read.ts for size: the quota a run
// starts from, the call on its target's key (D124), what a failure does (a 5xx or no answer goes to the
// back of the queue until its third attempt; a 429, or a workspace key's 401 or 403, ends the day), and
// what an answer keeps: the squads, the player read and its history (D132), members who joined since the
// day's roster, and the tracker's "Main squad might" version.
import type { Db } from "./db";
import { factVersion, insertFact } from "./repo/member-facts";
import { storePlayerRead } from "./repo/player-reads";
import { queueMembers, type MemberAfterCall } from "./repo/squad-queue";
import { latestSquads, storeSquads } from "./repo/squads";
import { markKey } from "./repo/workspace-keys";
import {
  QuotaExhaustedError,
  RequestError,
  UpstreamError,
  type PlayerSquadsInput,
} from "./sources/types";
import { afterFailure, mainSquad, trackerMightWrite } from "./squads";
import type { SquadsDeps } from "./squads-read";
import { forbidden, keyStatusOf, type OpenKey, type SquadTarget } from "./workspace-keys";

/** What the day's roster read left: where a run on LAP_API_KEY starts its quota from. */
export type StartDaily = {
  quotaRemainingBefore: number | null;
  callsUsed: number;
  startedAt: Date;
};

/**
 * The quota the day's run starts from. On LAP_API_KEY no call: the day's read left this much, at most (its
 * own calls counted after its check). On a workspace key, one /quota call on that key only; its answer
 * (or its 401 or 429) is the key's status.
 */
export async function startQuota(
  deps: SquadsDeps,
  db: Db,
  run: { daily: StartDaily; key: OpenKey | null; signal: AbortSignal },
): Promise<{ remaining: number | null; calls: number; reason: string | null }> {
  const { key } = run;
  if (!key) {
    const { quotaRemainingBefore: before, callsUsed } = run.daily;
    return { remaining: before === null ? null : before - callsUsed, calls: 0, reason: null };
  }
  const now = deps.now();
  try {
    const quota = await deps.v1.fetchQuota(undefined, run.signal, {
      apiKey: key.apiKey,
      maxRetries: 0,
    });
    const empty = quota.remaining <= 0;
    const status = empty ? "out_of_quota" : "ok";
    await markKey(db, key.workspaceId, key.nonce, { status, quotaRemaining: quota.remaining }, now);
    return { remaining: quota.remaining, calls: 1, reason: empty ? "key_out_of_quota" : null };
  } catch (e) {
    const status = keyStatusOf(e);
    if (status) {
      const patch = { status, ...(status === "out_of_quota" && { quotaRemaining: 0 }) };
      await markKey(db, key.workspaceId, key.nonce, patch, now);
    }
    // A 403 stops the night without marking the key; a 5xx or no answer leaves the quota unknown.
    const other = forbidden(e) ? "key_forbidden" : "quota_unknown";
    return { remaining: null, calls: 1, reason: status ? `key_${status}` : other };
  }
}

/** One batch's counts, carried into the day's row. */
export interface Batch {
  calls: number;
  read: number;
  withSquads: number;
  failed: number;
  might: number;
  /** Members added to the queue: they joined after the day's roster (D132). */
  joined: number;
  remaining: number | null;
  /** Ends the day: a 429, or a workspace key's 401 or 403. */
  stop: string | null;
}

/** A failure worth another attempt later: a 5xx, or no answer at all. Never a 429 or another 4xx. */
const retryable = (e: unknown) =>
  e instanceof RequestError || (e instanceof UpstreamError && e.status >= 500);

/** "unsent": the deadline came before the call; "lost": the claim was taken over; "done": go on. */
export type CallOutcome = "unsent" | "lost" | "done";

export type Call = {
  uid: number;
  /** The member's attempts today before this one. */
  attempts: number;
  target: SquadTarget;
  signal: AbortSignal;
  day: string;
  /** When the day's roster was read: a body whose alliance the tracker updated later can add members. */
  rosterAt: Date;
};

/**
 * One call for one member (the adapter itself never retries it), on the target's key. As soon as the
 * answer (or failure) is in, the counts and the member's queue row are saved in one write under the
 * batch's claim (`save`); then the answer is stored.
 */
export async function readOne(
  deps: SquadsDeps,
  db: Db,
  call: Call,
  b: Batch,
  save: (member: MemberAfterCall) => Promise<boolean>,
): Promise<CallOutcome> {
  let sent = false;
  const onAttempt = () => {
    sent = true;
    b.calls++;
  };
  const { key } = call.target;
  let player: PlayerSquadsInput;
  try {
    // INVARIANT keys.own-quota-only: a workspace key's read is sent on that key, never on LAP_API_KEY.
    const options = { maxRetries: 0, ...(key && { apiKey: key.apiKey }) };
    player = await deps.v1.fetchPlayer(call.uid, onAttempt, call.signal, options);
  } catch (e) {
    if (!sent) return "unsent";
    const member = await failedCall(deps, db, e, call, b);
    return (await save(member)) ? "done" : "lost";
  }
  b.remaining = player.quota?.remaining ?? (b.remaining === null ? null : b.remaining - 1);
  b.read++;
  if (player.squads.length > 0) b.withSquads++;
  const now = deps.now();
  // INVARIANT squads.once-per-member: the answer is saved before anything is stored, so a function killed
  // while storing never makes a later batch call this member again today.
  const done = { uid: call.uid, state: "done" as const, attempts: call.attempts + 1, dueAt: now };
  if (!(await save(done))) return "lost";
  await keep(db, call, player, now, b);
  return "done";
}

/** What one answer keeps (D117, D132): squads, the player read and history, new members, the might. */
async function keep(db: Db, call: Call, player: PlayerSquadsInput, now: Date, b: Batch) {
  const { unionId, workspaceId } = call.target;
  await storeSquads(db, unionId, call.uid, player.squads, now);
  await storePlayerRead(db, unionId, player, now);
  // D132: someone who joined after the day's roster read is queued, from a body whose alliance roster
  // the tracker updated since. Only the uids are read; the roster itself is never stored.
  const { roster } = player;
  if (roster && roster.unionId === unionId && roster.updatedAt > call.rosterAt)
    b.joined += await queueMembers(db, { day: call.day, unionId }, roster.uids, now);
  if (workspaceId !== null && (await writeMight(db, { workspaceId, unionId }, call.uid, now)))
    b.might++;
}

/** Why a failed call ends the day: a 429, or on a workspace key a 401 or a 403; null: it does not. */
function stopOn(e: unknown, status: string | null, onKey: boolean): string | null {
  if (e instanceof QuotaExhaustedError) return "quota_429";
  if (status === "invalid") return "key_invalid";
  return onKey && forbidden(e) ? "key_forbidden" : null;
}

/**
 * A call that was sent and failed. A 429 ends the day's read: the quota is spent until the reset. On a
 * workspace key a 401 ends it too, and the key is marked `invalid` (or `out_of_quota` after the 429): that
 * workspace's reads stop until an officer replaces the key or the quota resets, and never go on on our
 * key (D124). A 403 on a workspace key ends that day's read and leaves the key's status as it is. A 5xx,
 * no answer, or the batch's deadline cutting the call sends the member to the back of the queue, until
 * its third attempt (D132); any other failure is not tried again today. The member's row after the call.
 */
async function failedCall(
  deps: SquadsDeps,
  db: Db,
  e: unknown,
  call: Call,
  b: Batch,
): Promise<MemberAfterCall> {
  const { key } = call.target;
  const status = key ? keyStatusOf(e) : null;
  const now = deps.now();
  if (key && status) {
    const patch = { status, ...(status === "out_of_quota" && { quotaRemaining: 0 }) };
    await markKey(db, key.workspaceId, key.nonce, patch, now);
  }
  const stop = stopOn(e, status, key !== null);
  if (stop) b.stop = stop;
  else b.failed++;
  // A day that stops keeps the member waiting: nothing more is called today anyway.
  const again = stop !== null || retryable(e) || call.signal.aborted;
  return { uid: call.uid, ...afterFailure(call.attempts, again, now) };
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
