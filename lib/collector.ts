// Domain: runSnapshot, freshness check, per-alliance fallback, resume logic (plan Phase 3).
// Everything it touches comes in through Deps (plan §11.1); time comes from deps.now.
import { requiredQuota } from "./budget";
import { isFresh } from "./compute";
import type { Logger } from "./logger";
import { trimRaw } from "./raw-json";
import type { AllianceRow, MemberRow, Phase, Repo, SnapshotRow, SnapshotStatus } from "./repo";
import { ALLIANCES, SERVER } from "../config/alliances";
import {
  type AllianceSnapshotInput,
  type InternalSource,
  NotFoundError,
  NotLiveError,
  type Quota,
  QuotaExhaustedError,
  type RanksBoard,
  SchemaError,
  UpstreamError,
  type V1Source,
} from "./sources/types";

/** 20 alliances × 3 retries × 2 phases (Logging guarantees). */
export const MAX_UPSTREAM_CALLS = 120;
export const FRESH_MAX_AGE_MS = 20 * 60_000;
export const RUN_STALE_AFTER_MS = 10 * 60_000;
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

interface Run {
  deps: Deps;
  snapshotId: number;
  startedAt: Date;
  calls: number;
  lowestRemaining: number | null;
  board: RanksBoard | null;
  abort: string | null;
  capped: boolean;
}

/** One line from our own error classes; never a third-party message. */
function describe(e: unknown): string {
  if (e instanceof UpstreamError) return `http ${e.status}`;
  if (e instanceof NotFoundError) return "not found";
  if (e instanceof NotLiveError) return "not live";
  if (e instanceof SchemaError) return e.code;
  if (e instanceof QuotaExhaustedError) return "quota exhausted (429)";
  return e instanceof Error ? e.name : "unknown error";
}

/** The one place an upstream call is counted. Passed to every /v1 call as its onAttempt hook. */
function attemptHook(run: Run, unionId: number | null) {
  return (attempt: number) => {
    // INVARIANT calls.max-upstream: every /v1 attempt, quota check and retries included.
    if (run.calls >= MAX_UPSTREAM_CALLS) throw new CallCapError("MAX_UPSTREAM_CALLS reached");
    run.calls++;
    if (attempt > 0) void run.deps.logger.warn("v1.retry", { union_id: unionId, retry_n: attempt });
  };
}

/** The adapter returns only on 2xx and exposes no status then, so success is recorded as 200. */
function httpStatusOf(e: unknown): number | null {
  if (e === undefined) return 200;
  if (e instanceof UpstreamError) return e.status;
  if (e instanceof QuotaExhaustedError) return 429;
  return e instanceof NotFoundError ? 404 : null;
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
    ...(e === undefined ? {} : { error: describe(e) }),
  });
}

function noteQuota(run: Run, remaining: number | undefined) {
  if (remaining === undefined) return;
  run.lowestRemaining =
    run.lowestRemaining === null ? remaining : Math.min(run.lowestRemaining, remaining);
}

async function claim(deps: Deps, eventId: number, phase: Phase, force: boolean): Promise<number> {
  const existing: SnapshotRow | null = await deps.repo.findSnapshot(eventId, phase);
  const now = deps.now();
  if (existing?.status === "complete" && !force) throw new RunRefusedError("complete");
  // INVARIANT run.stale-after-10-min: a run left at running this long may be taken over.
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
    const quota = await run.deps.v1.fetchQuota(attemptHook(run, null));
    await logV1Fetch(run, started, { endpoint: "quota", unionId: null }, { quota });
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

function dataRow(run: Run, a: AllianceSnapshotInput, source: AllianceRow["source"]): AllianceRow {
  return {
    unionId: a.unionId,
    tag: a.tag,
    name: a.name,
    memberCount: a.memberCount,
    totalPower: a.totalPower,
    // INVARIANT total-kills-is-roster-sum: the board number is stored beside it, never instead.
    totalKills: a.totalKills,
    serverRank: a.serverRank,
    level: a.level,
    powerBoard: run.board?.power.get(a.unionId) ?? null,
    killsBoard: run.board?.kills.get(a.unionId) ?? null,
    source,
    sourceUpdatedAt: a.sourceUpdatedAt,
    cached: a.cached,
    // INVARIANT freshness.20-min: judged against deps.now at the time the row is stored.
    isFresh: isFresh(run.deps.now(), a.sourceUpdatedAt, FRESH_MAX_AGE_MS),
    error: null,
    raw: trimRaw(a.raw),
  };
}

function errorRow(unionId: number, error: string): AllianceRow {
  const label = ALLIANCES.find((a) => a.unionId === unionId);
  return {
    unionId,
    tag: label?.tag ?? null,
    name: label?.name ?? null,
    memberCount: null,
    totalPower: null,
    totalKills: null,
    serverRank: null,
    level: null,
    powerBoard: null,
    killsBoard: null,
    source: "v1",
    sourceUpdatedAt: null,
    cached: null,
    isFresh: false,
    error,
    raw: null,
  };
}

/** /v1 first; after its final failure one internal read (§3.5); else a row with the error. */
async function collectOne(run: Run, unionId: number): Promise<void> {
  const { deps } = run;
  let row: AllianceRow;
  let members: MemberRow[] = [];
  const started = deps.now();
  const call = { endpoint: "alliance", unionId } as const;
  try {
    const a = await deps.v1.fetchAlliance(unionId, attemptHook(run, unionId));
    await logV1Fetch(run, started, call, { cached: a.cached, quota: a.quota });
    noteQuota(run, a.quota?.remaining);
    row = dataRow(run, a, "v1");
    members = a.members;
  } catch (e) {
    await logV1Fetch(run, started, call, { error: e });
    if (e instanceof CallCapError) run.capped = true;
    if (e instanceof QuotaExhaustedError || e instanceof CallCapError) {
      // INVARIANT quota-429-aborts: no fallback, no further fetches; rows so far are kept.
      run.abort ??= run.capped ? "MAX_UPSTREAM_CALLS reached" : describe(e);
      return;
    }
    try {
      const a = await deps.internal.fetchAlliance(unionId);
      await deps.logger.warn("internal.fallback", { union_id: unionId, v1_error: describe(e) });
      row = dataRow(run, a, "internal");
      members = a.members;
    } catch (fallbackError) {
      row = errorRow(unionId, `v1 ${describe(e)}; internal ${describe(fallbackError)}`);
    }
  }
  if (!row.isFresh && row.error === null) await deps.logger.warn("stale", { union_id: unionId });
  await deps.repo.insertAllianceRow(run.snapshotId, row, members);
}

async function collectAll(run: Run, ids: number[]): Promise<void> {
  const queue = [...ids];
  const worker = async () => {
    try {
      while (run.abort === null) {
        const id = queue.shift();
        if (id === undefined) return;
        await collectOne(run, id);
      }
    } catch (e) {
      run.abort ??= describe(e);
      throw e;
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

async function finish(run: Run, ids: number[], phase: Phase, error: string | null) {
  const rows = (await run.deps.repo.listAllianceRows(run.snapshotId)).filter((r) =>
    ids.includes(r.unionId),
  );
  const ok = rows.filter((r) => r.error === null);
  // INVARIANT freshness.stale-is-partial: complete needs every alliance fresh and without error.
  const status =
    run.capped || ok.length === 0
      ? "failed"
      : ok.length === ids.length && ok.every((r) => r.isFresh)
        ? "complete"
        : "partial";
  const finishedAt = run.deps.now();
  const durationMs = finishedAt.getTime() - run.startedAt.getTime();
  await run.deps.repo.finishSnapshot(run.snapshotId, {
    status,
    finishedAt,
    callsUsed: run.calls,
    quotaRemainingAfter: run.lowestRemaining,
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
    quotaRemainingAfter: run.lowestRemaining,
    durationMs,
    error,
    stale: ok.filter((r) => !r.isFresh).map((r) => ({ unionId: r.unionId, tag: r.tag })),
    failed: rows.flatMap((r) =>
      r.error === null ? [] : [{ unionId: r.unionId, tag: r.tag, error: r.error }],
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
  options: { force?: boolean } = {},
): Promise<RunSummary> {
  const snapshotId = await claim(deps, eventId, phase, options.force ?? false);
  const run: Run = {
    deps,
    snapshotId,
    startedAt: deps.now(),
    calls: 0,
    lowestRemaining: null,
    board: null,
    abort: null,
    capped: false,
  };
  const ids = await allianceIds(deps, eventId, phase);
  await deps.logger.info("snapshot.start", { snapshot_id: snapshotId, alliances: ids.length });

  const quotaError = await checkQuota(run, ids.length);
  if (quotaError) return finish(run, ids, phase, quotaError);

  run.board = await fetchBoard(deps);
  // INVARIANT run.resume-missing-only: a re-run fetches only alliances without a row.
  const have = new Set((await deps.repo.listAllianceRows(snapshotId)).map((r) => r.unionId));
  await collectAll(
    run,
    ids.filter((id) => !have.has(id)),
  );
  if (run.abort) await deps.logger.error("abort", { reason: run.abort, calls_used: run.calls });
  return finish(run, ids, phase, run.abort);
}
