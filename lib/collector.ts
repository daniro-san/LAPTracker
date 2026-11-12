// Domain: runSnapshot, freshness check, per-alliance fallback, resume logic (plan Phase 3).
// Everything it touches comes in through Deps (plan §11.1); time comes from deps.now.
import { ALLIANCES, SERVER } from "../config/alliances";
import { requiredQuota } from "./budget";
import { dataRow, errorRow, failedList } from "./collector-rows";
import { RUN_STALE_AFTER_MS } from "./compute";
import type { Logger } from "./logger";
import type { AllianceRow, MemberRow, Phase, Repo, SnapshotRow, SnapshotStatus } from "./repo";
import {
  type InternalSource,
  type Quota,
  QuotaExhaustedError,
  type RanksBoard,
  type V1Source,
} from "./sources/types";
import { describe, httpStatusOf, upstreamDetail } from "./upstream-errors";

/** 20 alliances × 3 retries × 2 phases (Logging guarantees). */
export const MAX_UPSTREAM_CALLS = 120;
export { FRESH_MAX_AGE_MS } from "./collector-rows";
/** Measured from the start of the run; the route's maxDuration is 120 s (docs/decisions/D25). */
export const RUN_DEADLINE_MS = 100_000;
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
  phase: Phase;
  status: Exclude<SnapshotStatus, "running">;
  callsUsed: number;
  quotaRemainingAfter: number | null;
  durationMs: number;
  error: string | null;
  stale: { unionId: number; tag: string | null }[];
  failed: { unionId: number; tag: string | null; error: string }[];
}

/** The run did not start: the snapshot is complete (pass force) or another run holds it. */
export class RunRefusedError extends Error {
  override name = "RunRefusedError";
  constructor(readonly reason: "complete" | "running" | "no-event") {
    super(`snapshot run refused: ${reason}`);
  }
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
  startedAt: Date;
  calls: number;
  /** The lowest quota remaining seen, and run.calls then: the calls after it returned no quota. */
  lowest: { remaining: number | null; calls: number };
  /** The quota check's remaining: the run's starting point for the rehearsal's quota-drop check. */
  quotaBefore: number | null;
  board: RanksBoard | null;
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
    deadline_ms: RUN_DEADLINE_MS,
    calls_used: run.calls,
  });
  run.controller.abort();
}

/** INVARIANT run.deadline-100s: past this no read starts, the snapshot closes partial. */
const pastDeadline = (run: Run) =>
  run.deps.now().getTime() - run.startedAt.getTime() >= RUN_DEADLINE_MS;

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

/** One run_logs line per /v1 call (plan "Observability"); retries add their own v1.retry lines. */
async function logV1Fetch(
  run: Run,
  started: Date,
  call: { endpoint: "alliance" | "quota"; unionId: number | null },
  result: { cached?: boolean | null; quota?: Quota | null; error?: unknown },
): Promise<void> {
  const e = result.error;
  await run.deps.logger[e === undefined ? "info" : "warn"]("v1.fetch", {
    endpoint: call.endpoint,
    union_id: call.unionId,
    http_status: httpStatusOf(e),
    cached: result.cached ?? null,
    duration_ms: run.deps.now().getTime() - started.getTime(),
    quota_remaining: result.quota?.remaining ?? null,
    // D61: what the upstream answered (status, headers, body start, or the timeout), for the run page.
    ...(e === undefined ? {} : { error: describe(e), detail: upstreamDetail(e) }),
  });
}

function noteQuota(run: Run, remaining: number | undefined) {
  if (remaining === undefined || remaining > (run.lowest.remaining ?? remaining)) return;
  run.lowest = { remaining, calls: run.calls };
}

async function claim(deps: Deps, eventId: number, phase: Phase, force: boolean): Promise<number> {
  const existing: SnapshotRow | null = await deps.repo.findSnapshot(eventId, phase);
  const now = deps.now();
  if (existing?.status === "complete" && !force) throw new RunRefusedError("complete");
  // INVARIANT run.stale-after-150s: a run left at running this long may be taken over.
  const live = now.getTime() - (existing?.startedAt.getTime() ?? 0) < RUN_STALE_AFTER_MS;
  if (existing?.status === "running" && live) throw new RunRefusedError("running");
  const id = await deps.repo.startSnapshot(eventId, phase, now, existing);
  if (id === null) throw new RunRefusedError("running");
  if (force && existing) await deps.repo.clearAllianceRows(id);
  return id;
}

async function allianceIds(deps: Deps, eventId: number, phase: Phase): Promise<number[]> {
  const event = await deps.repo.getEvent(eventId);
  if (!event) throw new RunRefusedError("no-event");
  // INVARIANT event.after-uses-event-copy: BEFORE copies the config; AFTER never reads it.
  if (phase === "after") return event.allianceIds;
  const ids = ALLIANCES.map((a) => a.unionId);
  await deps.repo.setEventAllianceIds(eventId, ids);
  return ids;
}

/** Returns an error line when the run must not fetch rosters, else null. */
async function checkQuota(run: Run, idCount: number): Promise<string | null> {
  const started = run.deps.now();
  try {
    const quota = await run.deps.v1.fetchQuota(attemptHook(run, null), run.controller.signal);
    await logV1Fetch(run, started, { endpoint: "quota", unionId: null }, { quota });
    run.quotaBefore = quota.remaining;
    noteQuota(run, quota.remaining);
    // INVARIANT budget.reserve-for-after
    const needed = requiredQuota(idCount);
    if (quota.remaining >= needed) return null;
    await run.deps.logger.error("quota", { remaining: quota.remaining, required: needed });
    return `quota: remaining ${quota.remaining} < required ${needed}`;
  } catch (e) {
    await logV1Fetch(run, started, { endpoint: "quota", unionId: null }, { error: e });
    await run.deps.logger.error("quota", { error: describe(e) });
    return `quota: ${describe(e)}`;
  }
}

async function fetchBoard(deps: Deps): Promise<RanksBoard | null> {
  try {
    return await deps.internal.fetchRanks(SERVER);
  } catch (e) {
    // The board is a cross-check only (§3.5): its failure never changes the status.
    await deps.logger.warn("board.failed", { error: describe(e) });
    return null;
  }
}

/** After a /v1 failure: one internal read (§3.5), else a row carrying both errors. */
async function fallbackRow(run: Run, unionId: number, v1Error: unknown) {
  const { deps } = run;
  try {
    const a = await deps.internal.fetchAlliance(unionId);
    await deps.logger.warn("internal.fallback", { union_id: unionId, v1_error: describe(v1Error) });
    return { row: dataRow(run.board, deps.now(), a, "internal"), members: a.members };
  } catch (fallbackError) {
    const error = `v1 ${describe(v1Error)}; internal ${describe(fallbackError)}`;
    return { row: errorRow(unionId, error), members: [] as MemberRow[] };
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
    );
    await logV1Fetch(run, started, call, { cached: a.cached, quota: a.quota });
    noteQuota(run, a.quota?.remaining);
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
  await deps.repo.insertAllianceRow(run.snapshotId, row, members);
}

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

async function finish(run: Run, ids: number[], phase: Phase, error: string | null) {
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
    failed: failedList(rows, ids, error),
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
  options: { force?: boolean } = {},
): Promise<RunSummary> {
  const snapshotId = await claim(deps, eventId, phase, options.force ?? false);
  const run: Run = {
    deps,
    snapshotId,
    startedAt: deps.now(),
    calls: 0,
    lowest: { remaining: null, calls: 0 },
    quotaBefore: null,
    board: null,
    abort: null,
    capped: false,
    controller: new AbortController(),
    deadlineHit: false,
  };
  const ids = await allianceIds(deps, eventId, phase);
  await deps.logger.info("snapshot.start", { snapshot_id: snapshotId, alliances: ids.length });
  // The tick creates the event with an empty list; only BEFORE fills it. No list, no quota call.
  if (ids.length === 0) {
    return finish(run, ids, phase, "no alliance list on the event: BEFORE has not run");
  }

  // The deadline wins the race when a read hangs; the abandoned work is cut by the abort signal.
  const work = (async () => {
    const quotaError = await checkQuota(run, ids.length);
    if (quotaError) return quotaError;
    run.board = await fetchBoard(deps);
    // INVARIANT run.resume-missing-only: a re-run fetches only alliances without a row.
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
    const left = RUN_DEADLINE_MS - (deps.now().getTime() - run.startedAt.getTime());
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
  return finish(run, ids, phase, error);
}
