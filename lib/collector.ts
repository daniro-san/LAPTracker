// Domain: runSnapshot, freshness check, per-alliance fallback, resume logic (plan Phase 3).
// Everything it touches comes in through Deps (plan §11.1); time comes from deps.now.
import { laterWindowReads, requiredQuota, sampleQuota } from "./budget";
import { claim, RunRefusedError } from "./collector-claim";
import { checkIdentity } from "./collector-identity";
import { allianceIds, fetchBoard } from "./collector-ids";
import { logRosterCheck, logV1Fetch } from "./collector-log";
import { opponentEndsDue, readOpponent } from "./collector-opponent";
import { dataRow, errorRow, failedList, MAX_UPSTREAM_CALLS } from "./collector-rows";
import { callOptions, SAMPLE_DEADLINE_MS } from "./collector-sample";
import { RUN_DEADLINE_MS } from "./compute";
import type { Logger } from "./logger";
import type { AllianceRow, MemberRow, Phase, Repo, SnapshotPhase, SnapshotStatus } from "./repo";
import {
  type InternalSource,
  QuotaExhaustedError,
  type RanksBoard,
  type V1Source,
} from "./sources/types";
import { describe } from "./upstream-errors";

export { FRESH_MAX_AGE_MS, MAX_UPSTREAM_CALLS } from "./collector-rows";
export { RunRefusedError } from "./collector-claim";
/** Measured from the start of the run (docs/decisions/D25); defined in lib/compute so pages can read it. */
export { RUN_DEADLINE_MS };
const CONCURRENCY = 4;

export interface Deps {
  v1: V1Source;
  internal: InternalSource;
  repo: Repo;
  logger: Logger;
  now: () => Date;
}

export interface RunSummary {
  snapshotId: number;
  phase: SnapshotPhase;
  status: Exclude<SnapshotStatus, "running">;
  callsUsed: number;
  quotaRemainingAfter: number | null;
  durationMs: number;
  error: string | null;
  stale: { unionId: number; tag: string | null }[];
  failed: { unionId: number; tag: string | null; error: string }[];
}

class CallCapError extends Error {
  override name = "CallCapError";
}

class DeadlineError extends Error {
  override name = "DeadlineError";
}

interface Run {
  deps: Deps;
  snapshotId: number;
  /** A sample (D69): no ranks board, no internal fallback, members stored as arrays. */
  sample: boolean;
  /** Measured from `startedAt`: RUN_DEADLINE_MS, or SAMPLE_DEADLINE_MS for a sample. */
  deadlineMs: number;
  eventId: number;
  /** A sample's count of the KvK opponent's End reads still due (D152), kept in its quota rule. */
  opponentDue?: number;
  /** The later windows' Befores and Afters still due this UTC day (D160), kept in the quota rule. */
  laterReads: number;
  startedAt: Date;
  calls: number;
  /** The lowest quota remaining seen, and run.calls then: the calls after it returned no quota. */
  lowest: { remaining: number | null; calls: number };
  /** The quota check's remaining: the run's starting point for the rehearsal's quota-drop check. */
  quotaBefore: number | null;
  board: RanksBoard | null;
  /** The run's alliances' newest tags and names (D133), for the rows and the summary of those that failed. */
  labels: Map<number, { tag: string | null; name: string | null }>;
  /** The run's alliances' newest daily roster uids, for the identity check (D69 amendment, 2026-11-21). */
  rosters: Map<number, number[]>;
  abort: string | null;
  capped: boolean;
  /** Aborts every in-flight /v1 call when the deadline is reached. */
  controller: AbortController;
  deadlineHit: boolean;
}

/** The first call closes the run's reads: nothing new starts, in-flight calls are cut. */
function hitDeadline(run: Run) {
  if (run.deadlineHit) return;
  run.deadlineHit = true;
  run.abort ??= "deadline";
  void run.deps.logger.warn("run.deadline", {
    deadline_ms: run.deadlineMs,
    calls_used: run.calls,
  });
  run.controller.abort();
}

/** INVARIANT run.deadline-100s: past this no read starts, the snapshot closes partial (25 s for a sample). */
const pastDeadline = (run: Run) =>
  run.deps.now().getTime() - run.startedAt.getTime() >= run.deadlineMs;

/** The one place an upstream call is counted. Passed to every /v1 call as its onAttempt hook. */
function attemptHook(run: Run, unionId: number | null) {
  return (attempt: number, status?: number | null) => {
    // A retry that wakes up after the deadline is not sent and not counted.
    if (run.deadlineHit) throw new DeadlineError("run deadline reached");
    // INVARIANT calls.max-upstream: every /v1 attempt, quota check and retries included.
    if (run.calls >= MAX_UPSTREAM_CALLS) throw new CallCapError("MAX_UPSTREAM_CALLS reached");
    run.calls++;
    const retry = { union_id: unionId, retry_n: attempt, http_status: status ?? null };
    if (attempt > 0) void run.deps.logger.warn("v1.retry", retry);
  };
}

function noteQuota(run: Run, remaining: number | undefined) {
  if (remaining === undefined || remaining > (run.lowest.remaining ?? remaining)) return;
  run.lowest = { remaining, calls: run.calls };
}

/** Returns an error line when the run must not fetch rosters, else null. */
async function checkQuota(run: Run, idCount: number): Promise<string | null> {
  const started = run.deps.now();
  try {
    const quota = await run.deps.v1.fetchQuota(
      attemptHook(run, null),
      run.controller.signal,
      callOptions(run),
    );
    await logV1Fetch(run, started, { endpoint: "quota", unionId: null }, { quota });
    run.quotaBefore = quota.remaining;
    noteQuota(run, quota.remaining);
    // INVARIANT budget.reserve-for-after; for a sample, INVARIANT budget.samples-yield-to-after (D69);
    // both with INVARIANT budget.reserve-for-later-windows (D160).
    const needed = run.sample
      ? sampleQuota(idCount, run.opponentDue, run.laterReads)
      : requiredQuota(idCount, run.laterReads);
    if (quota.remaining >= needed) return null;
    await run.deps.logger.error("quota", { remaining: quota.remaining, required: needed });
    return `quota: remaining ${quota.remaining} < required ${needed}`;
  } catch (e) {
    await logV1Fetch(run, started, { endpoint: "quota", unionId: null }, { error: e });
    await run.deps.logger.error("quota", { error: describe(e) });
    return `quota: ${describe(e)}`;
  }
}

/** After a /v1 failure: one internal read (§3.5), else a row carrying both errors. D5's fallback covers
 * Before and After only: a sample's failed alliance gets an error row (D69). */
async function fallbackRow(run: Run, unionId: number, v1Error: unknown) {
  const { deps } = run;
  const label = run.labels.get(unionId);
  if (run.sample) return { row: errorRow(unionId, `v1 ${describe(v1Error)}`, label), members: [] };
  try {
    const a = await deps.internal.fetchAlliance(unionId);
    await deps.logger.warn("internal.fallback", { union_id: unionId, v1_error: describe(v1Error) });
    checkIdentity(run, unionId, a);
    await logRosterCheck(deps.logger, a);
    return { row: dataRow(run.board, deps.now(), a, "internal"), members: a.members };
  } catch (fallbackError) {
    const error = `v1 ${describe(v1Error)}; internal ${describe(fallbackError)}`;
    return { row: errorRow(unionId, error, label), members: [] as MemberRow[] };
  }
}

/** /v1 first; after its final failure one internal read (§3.5); else a row with the error. */
async function collectOne(run: Run, unionId: number): Promise<void> {
  const { deps } = run;
  let row: AllianceRow;
  let members: MemberRow[];
  const started = deps.now();
  const call = { endpoint: "alliance", unionId } as const;
  try {
    const a = await deps.v1.fetchAlliance(
      unionId,
      attemptHook(run, unionId),
      run.controller.signal,
      callOptions(run),
    );
    noteQuota(run, a.quota?.remaining);
    // A 200 holding another alliance is a failed read of this one: its call is spent, nothing retries it,
    // and its one v1.fetch line below carries the error.
    checkIdentity(run, unionId, a);
    await logV1Fetch(run, started, call, { cached: a.cached, quota: a.quota });
    await logRosterCheck(deps.logger, a);
    row = dataRow(run.board, deps.now(), a, "v1");
    members = a.members;
  } catch (e) {
    // The run has closed (deadline or a worker's throw): no fallback, no row, no log line.
    if (run.controller.signal.aborted) return;
    await logV1Fetch(run, started, call, { error: e });
    if (e instanceof CallCapError) run.capped = true;
    if (e instanceof QuotaExhaustedError || e instanceof CallCapError) {
      // INVARIANT quota-429-aborts: no fallback, no further fetches; rows so far are kept.
      run.abort ??= run.capped ? "MAX_UPSTREAM_CALLS reached" : describe(e);
      return;
    }
    ({ row, members } = await fallbackRow(run, unionId, e));
  }
  if (run.controller.signal.aborted) return;
  if (!row.isFresh && row.error === null) await deps.logger.warn("stale", { union_id: unionId });
  await store(run, row, members);
}

/** A Before or After row with its member rows; a sample's row with its members as arrays (D69). */
const store = (run: Run, row: AllianceRow, members: MemberRow[]) =>
  run.sample
    ? run.deps.repo.insertSampleRow(run.snapshotId, row, members)
    : run.deps.repo.insertAllianceRow(run.snapshotId, row, members);

async function collectAll(run: Run, ids: number[]): Promise<void> {
  const queue = [...ids];
  const worker = async () => {
    try {
      while (run.abort === null) {
        if (pastDeadline(run)) return hitDeadline(run);
        const id = queue.shift();
        if (id === undefined) return;
        await collectOne(run, id);
      }
    } catch (e) {
      // INVARIANT run.no-row-after-throw: cut the other reads before the caller finalises the row.
      run.controller.abort((run.abort ??= describe(e)));
      throw e;
    }
  };
  for (const s of await Promise.allSettled(Array.from({ length: CONCURRENCY }, worker)))
    if (s.status === "rejected") throw s.reason;
}

async function finish(run: Run, ids: number[], phase: SnapshotPhase, error: string | null) {
  const rows = (await run.deps.repo.listAllianceRows(run.snapshotId)).filter((r) =>
    ids.includes(r.unionId),
  );
  const ok = rows.filter((r) => r.error === null);
  // INVARIANT freshness.stale-is-partial: complete needs every alliance fresh and without error.
  const status =
    run.capped || (ok.length === 0 && !run.deadlineHit)
      ? "failed"
      : !run.deadlineHit && ok.length === ids.length && ok.every((r) => r.isFresh)
        ? "complete"
        : "partial";
  const finishedAt = run.deps.now();
  const durationMs = finishedAt.getTime() - run.startedAt.getTime();
  await run.deps.repo.finishSnapshot(run.snapshotId, {
    status,
    finishedAt,
    callsUsed: run.calls,
    quotaRemainingBefore: run.quotaBefore,
    quotaRemainingAfter: run.lowest.remaining,
    quotaUnseenCalls: run.calls - run.lowest.calls,
    boardPulledAt: run.board?.pulledAt ?? null,
    error,
    durationMs,
  });
  await run.deps.logger.info("snapshot.finish", { status, calls_used: run.calls });
  return {
    snapshotId: run.snapshotId,
    phase,
    status,
    callsUsed: run.calls,
    quotaRemainingAfter: run.lowest.remaining,
    durationMs,
    error,
    stale: ok.filter((r) => !r.isFresh).map((r) => ({ unionId: r.unionId, tag: r.tag })),
    failed: failedList(
      rows,
      ids,
      error,
      new Map(ids.map((id) => [id, run.labels.get(id)?.tag ?? null])),
    ),
  } satisfies RunSummary;
}

/**
 * Collect one snapshot for (event, phase). Expected failures (upstream errors, 429, quota, the call
 * cap) end in a finished snapshot; anything else propagates and leaves it `running`, which the
 * caller finalises and which becomes re-runnable after RUN_STALE_AFTER_MS.
 */
export async function runSnapshot(
  eventId: number,
  phase: Phase,
  deps: Deps,
  options: { force?: boolean; stale?: boolean | undefined; window?: number } = {},
): Promise<RunSummary> {
  const { force = false, stale, window = 1 } = options;
  const snapshotId = await claim(deps, eventId, phase, { force, stale, window });
  const run = newRun(deps, eventId, snapshotId, false);
  run.laterReads = await laterReadsOf(deps, eventId, window);
  return collectRun(run, await allianceIds(deps, eventId, phase, window), phase);
}

/** The event's later windows' reads still due this UTC day (D160); 0 for a one-window event. */
async function laterReadsOf(deps: Deps, eventId: number, window: number): Promise<number> {
  return laterWindowReads(await deps.repo.eventWindows(eventId), window, deps.now());
}

/** Collect the event's sample at `slotAt` (D69): a phase's /v1 path, the sample's budget rule, no ranks
 * board, no internal fallback. Refused ("taken") when the slot already has a row. `window`: the event
 * window the slot is in (D160). */
export async function runSample(
  eventId: number,
  slotAt: Date,
  deps: Deps,
  window = 1,
): Promise<RunSummary> {
  const snapshotId = await deps.repo.startSample(eventId, slotAt, deps.now(), window);
  if (snapshotId === null) throw new RunRefusedError("taken");
  const run = newRun(deps, eventId, snapshotId, true);
  run.laterReads = await laterReadsOf(deps, eventId, window);
  // INVARIANT budget.samples-yield-to-after, with the opponent's End reads in the After's reserve (D152).
  run.opponentDue = await opponentEndsDue(deps, eventId);
  return collectRun(run, await allianceIds(deps, eventId, "sample"), "sample");
}

function newRun(deps: Deps, eventId: number, snapshotId: number, sample: boolean): Run {
  return {
    deps,
    eventId,
    snapshotId,
    sample,
    deadlineMs: sample ? SAMPLE_DEADLINE_MS : RUN_DEADLINE_MS,
    laterReads: 0,
    startedAt: deps.now(),
    calls: 0,
    lowest: { remaining: null, calls: 0 },
    quotaBefore: null,
    board: null,
    labels: new Map(),
    rosters: new Map(),
    abort: null,
    capped: false,
    controller: new AbortController(),
    deadlineHit: false,
  };
}

/** The claimed run's reads: the quota check, the rosters, under the deadline; then the row's outcome. */
async function collectRun(run: Run, ids: number[], phase: SnapshotPhase): Promise<RunSummary> {
  const { deps, snapshotId } = run;
  await deps.logger.info("snapshot.start", { snapshot_id: snapshotId, alliances: ids.length });
  // The tick creates the event with an empty list; only BEFORE fills it. No list, no quota call.
  if (ids.length === 0) {
    return finish(run, ids, phase, "no alliance list on the event: BEFORE has not run");
  }
  run.labels = await deps.repo.allianceLabels(ids);
  run.rosters = await deps.repo.lastMemberUids(ids);

  // The deadline wins the race when a read hangs; the abandoned work is cut by the abort signal.
  const work = (async () => {
    const quotaError = await checkQuota(run, ids.length);
    if (quotaError) return quotaError;
    // The ranks board (internal API) cross-checks a Before and an After only, never a sample (D5, D69).
    if (!run.sample) run.board = await fetchBoard(deps);
    // INVARIANT run.resume-missing-only: a re-run fetches only alliances without a row; the failed
    // rows were dropped at the claim (D62), so that is every alliance not read yet.
    const have = new Set((await deps.repo.listAllianceRows(snapshotId)).map((r) => r.unionId));
    await collectAll(
      run,
      ids.filter((id) => !have.has(id)),
    );
    return run.abort;
  })();
  work.catch(() => {});
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<void>((resolve) => {
    const left = run.deadlineMs - (deps.now().getTime() - run.startedAt.getTime());
    timer = setTimeout(() => resolve(hitDeadline(run)), Math.max(0, left));
  });
  let error: string | null;
  try {
    error = (await Promise.race([work, deadline])) ?? run.abort;
  } finally {
    clearTimeout(timer);
  }
  if (error && !run.deadlineHit)
    await deps.logger.error("abort", { reason: error, calls_used: run.calls });
  // D152: the KvK opponent after our own reads have settled, in the time left; never a sample's.
  if (!error && !run.deadlineHit) await readOpponent(run, phase, ids.length);
  return finish(run, ids, phase, error);
}
