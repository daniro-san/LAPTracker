// The KvK opponent's reads (D152, issue 306): after a scheduled event's own Start or End reads have settled, in
// the time the run has left, one /v1 call per opponent alliance. Split from lib/collector.ts. Nothing here
// changes the snapshot's status or error: those come from our own alliances' rows only.
import { requiredQuota } from "./budget";
import type { Deps } from "./collector";
import { sameMembers } from "./collector-identity";
import { logV1Fetch } from "./collector-log";
import { FRESH_MAX_AGE_MS, MAX_UPSTREAM_CALLS } from "./collector-rows";
import { isFresh } from "./compute";
import { opponentDue } from "./kvk";
import type { OpponentInfo, OpponentRead, Phase, SnapshotPhase } from "./repo";
import {
  type AllianceSnapshotInput,
  NotFoundError,
  QuotaExhaustedError,
  UpstreamError,
} from "./sources/types";
import { describe } from "./upstream-errors";

/** No opponent call starts with less of the run's time left: it must end before the run answers. */
export const OPPONENT_MIN_LEFT_MS = 5_000;
/** An opponent call's longest timeout (D152); within the time left, as `callOne` sets it. */
const OPPONENT_CALL_TIMEOUT_MS = 12_000;
/** The row a call claims before it is sent (INVARIANT kvk.one-call-per-row); the answer replaces it. A run
 * that dies in between leaves it, so that tag is never sent again. */
export const SENT = "sent: no answer stored";
/** A claim whose call was never sent: the run stopped (a 429, a worker's failure) while it waited on it. Like
 * every row, it is never read again. */
export const NOT_SENT = "not sent: the run stopped";
const CONCURRENCY = 4;

/** The run's state this reads and adds its calls to; never its `abort`, `capped` or `deadlineHit`. */
export interface OpponentRun {
  deps: Deps;
  snapshotId: number;
  startedAt: Date;
  deadlineMs: number;
  calls: number;
  lowest: { remaining: number | null; calls: number };
}

type Due = ReturnType<typeof opponentDue>[number];

const errorText = (e: unknown) =>
  e instanceof NotFoundError
    ? "not found"
    : e instanceof UpstreamError && e.status === 409
      ? "not unique"
      : describe(e);

/** Why an answer is not this alliance, or null: another server, another id, or another roster at the End. */
function wrongAnswer(o: OpponentInfo, due: Due, a: AllianceSnapshotInput, known: Set<number>) {
  if (a.sid != null && a.sid !== o.server) return "wrong server";
  if (!due.start) return known.has(a.unionId) ? "duplicate" : null;
  if (a.unionId !== due.start.unionId) return "wrong alliance (id)";
  const uids = a.members.map((m) => m.uid);
  // INVARIANT collector.identity-checked, for the opponent: the End must be the Start's alliance (D69 amendment).
  return sameMembers(uids, due.start.memberUids ?? []) ? null : "wrong alliance (roster)";
}

const emptyRow = (
  o: OpponentInfo,
  run: OpponentRun,
  phase: Phase,
  due: Due,
  at: Date,
): OpponentRead => ({
  opponentId: o.id,
  snapshotId: run.snapshotId,
  phase,
  tag: due.tag,
  unionId: due.start?.unionId ?? null,
  sid: null,
  name: null,
  memberCount: null,
  totalPower: null,
  totalKills: null,
  memberUids: null,
  memberPower: null,
  memberKills: null,
  sourceUpdatedAt: null,
  cached: null,
  isFresh: false,
  error: null,
  readAt: at,
});

/** The members as arrays only: no name, no photo, no raw body (INVARIANT kvk.no-member-names). */
function dataRow(base: OpponentRead, a: AllianceSnapshotInput): OpponentRead {
  return {
    ...base,
    unionId: a.unionId,
    sid: a.sid ?? null,
    name: a.name,
    memberCount: a.memberCount,
    totalPower: a.totalPower,
    totalKills: a.totalKills,
    memberUids: a.members.map((m) => m.uid),
    memberPower: a.members.map((m) => m.power),
    memberKills: a.members.map((m) => m.kills),
    sourceUpdatedAt: a.sourceUpdatedAt,
    cached: a.cached,
    isFresh: isFresh(base.readAt, a.sourceUpdatedAt, FRESH_MAX_AGE_MS),
  };
}

const timeLeft = (run: OpponentRun) =>
  run.deadlineMs - (run.deps.now().getTime() - run.startedAt.getTime());

/** One phase's reads of one opponent: what they share, and whether a 429 stopped them. */
interface Pass {
  run: OpponentRun;
  o: OpponentInfo;
  phase: Phase;
  /** The union ids the opponent's Start rows hold, so one alliance is stored once. */
  known: Set<number>;
  stopped: boolean;
}

/** Whether the next call may be sent: no 429 yet, before the war for a Start (INVARIANT
 * kvk.start-before-war), enough of the run's time left, and under MAX_UPSTREAM_CALLS. */
function mayCall(p: Pass): boolean {
  const late = p.phase === "before" && p.run.deps.now() >= p.o.eventAtUtc;
  const short = timeLeft(p.run) < OPPONENT_MIN_LEFT_MS;
  return !p.stopped && !late && !short && p.run.calls < MAX_UPSTREAM_CALLS;
}

/** One opponent call, one attempt, and the row it leaves, data or error. */
async function callOne(p: Pass, due: Due, sent: OpponentRead): Promise<OpponentRead> {
  const { run, o } = p;
  const { deps } = run;
  const options = {
    maxRetries: 0,
    timeoutMs: Math.min(OPPONENT_CALL_TIMEOUT_MS, timeLeft(run) - 1_000),
  };
  // The one attempt was counted when the worker reserved it (`reserve`): no retry adds another.
  const hook = () => {};
  const started = sent.readAt;
  const call = { endpoint: "alliance", unionId: due.start?.unionId ?? null } as const;
  const row = { ...sent, error: null };
  try {
    const a = due.start
      ? await deps.v1.fetchAlliance(due.start.unionId as number, hook, undefined, options)
      : await deps.v1.fetchAllianceByTag(o.server, due.tag, hook, undefined, options);
    const seen = run.lowest.remaining;
    if (a.quota && (seen === null || a.quota.remaining <= seen))
      run.lowest = { remaining: a.quota.remaining, calls: run.calls };
    await logV1Fetch(run, started, call, { cached: a.cached, quota: a.quota });
    const read = { ...row, readAt: deps.now() };
    const wrong = wrongAnswer(o, due, a, p.known);
    if (wrong) return { ...read, error: wrong };
    p.known.add(a.unionId);
    return dataRow(read, a);
  } catch (e) {
    // A 429 stops the other calls before anything else is awaited.
    if (e instanceof QuotaExhaustedError) p.stopped = true;
    await logV1Fetch(run, started, call, { error: e });
    return { ...row, error: errorText(e) };
  }
}

/** Claim the tag's row, then call, then store the answer over the claim. A claim another run holds is skipped. */
async function readOne(p: Pass, due: Due): Promise<void> {
  const { deps } = p.run;
  const sent = { ...emptyRow(p.o, p.run, p.phase, due, deps.now()), error: SENT };
  // INVARIANT kvk.one-call-per-row: the row exists before the call is sent.
  const claimed = await deps.repo.insertOpponentRead(sent).catch((e: unknown) => {
    p.run.calls--;
    throw e;
  });
  // Another run holds the row: no call, so its reserved count is given back.
  if (!claimed) return void p.run.calls--;
  // The run stopped while this claim was written: the call is not sent, and its count is given back.
  if (p.stopped) {
    p.run.calls--;
    return deps.repo.updateOpponentRead({ ...sent, error: NOT_SENT });
  }
  await deps.repo.updateOpponentRead(await callOne(p, due, sent));
}

/** Whether the next call may go, and if so its count taken now, in the same synchronous step as the check:
 * the workers await their claims in between, so a count taken at the call would let four pass the cap
 * together (INVARIANT calls.max-upstream). */
function reserve(p: Pass): boolean {
  if (!mayCall(p)) return false;
  p.run.calls++;
  return true;
}

/**
 * The opponent's reads of this phase. Quota (INVARIANT budget.reserve-for-after, with the opponent): the run's
 * remaining as last seen, less the calls since that answer, must hold `requiredQuota(n + k)`, else nothing is
 * read. Each call is one attempt on LAP_API_KEY, counted into the run's calls under MAX_UPSTREAM_CALLS; a 429
 * stops the rest. Every call sent leaves a row.
 */
export async function collectOpponent(
  run: OpponentRun,
  eventId: number,
  phase: Phase,
  ourCount: number,
): Promise<void> {
  const { deps } = run;
  const o = await deps.repo.opponentFor(eventId);
  if (!o) return;
  const reads = await deps.repo.opponentReads(o.id);
  const queue = opponentDue(o, reads, phase);
  if (queue.length === 0) return;
  const { remaining, calls } = run.lowest;
  const estimate = remaining === null ? null : remaining - (run.calls - calls);
  const needed = requiredQuota(ourCount + queue.length);
  if (estimate === null || estimate < needed) {
    await deps.logger.warn("opponent.quota", { remaining: estimate, required: needed });
    return;
  }
  const starts = reads.filter((r) => r.phase === "before" && r.unionId !== null);
  const pass: Pass = {
    run,
    o,
    phase,
    known: new Set(starts.map((r) => r.unionId as number)),
    stopped: false,
  };
  const worker = async () => {
    try {
      for (let due = queue.shift(); due && reserve(pass); due = queue.shift())
        await readOne(pass, due);
    } catch (e) {
      // One worker's failure stops the others before their next call.
      pass.stopped = true;
      throw e;
    }
  };
  await deps.logger.info("opponent.start", { phase, alliances: queue.length });
  const settled = await Promise.allSettled(Array.from({ length: CONCURRENCY }, worker));
  const failed = settled.find((r) => r.status === "rejected");
  if (failed) throw failed.reason;
}

/** The opponent's reads of a Before or an After, never a sample's; their failure is logged and never fails or
 * changes our snapshot (INVARIANT kvk.never-changes-status). */
export async function readOpponent(
  run: OpponentRun & { eventId: number },
  phase: SnapshotPhase,
  ourCount: number,
) {
  if (phase === "sample") return;
  try {
    await collectOpponent(run, run.eventId, phase, ourCount);
  } catch (e) {
    await run.deps.logger.error("opponent.failed", { error: describe(e) });
  }
}

/** A sample's count of the opponent's End reads still due (D152), for its quota rule. Its failure is logged
 * and counts none, so the opponent never changes a sample's outcome (INVARIANT kvk.never-changes-status). */
export async function opponentEndsDue(deps: Deps, eventId: number): Promise<number> {
  try {
    const o = await deps.repo.opponentFor(eventId);
    return o ? opponentDue(o, await deps.repo.opponentReads(o.id), "after").length : 0;
  } catch (e) {
    await deps.logger.error("opponent.failed", { error: describe(e) });
    return 0;
  }
}
