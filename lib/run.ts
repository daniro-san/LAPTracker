// Runs a snapshot for a route (plan Phase 4) and the Friday quota report (plan §3.1). The finally
// block exists because a serverless function is frozen once it returns: the snapshot row must be
// final and the logger's inserts settled before the response leaves, on every path.
import { secretsOf, type AppContext } from "./app-context";
import { RunRefusedError, runSnapshot, type RunSummary } from "./collector";
import type { Db } from "./db";
import { createRunLogger } from "./logger";
import {
  adminSnapshotMessage,
  createNotifier,
  publicSnapshotMessage,
  rehearsalVerdictMessage,
} from "./notify";
import { rehearsalVerdict } from "./rehearsal";
import { createRepo, type Phase, type Repo } from "./repo";
import { databaseSizeBytes } from "./repo/database";
import type { EventInfo } from "./repo/events";
import { loadVerdictInput } from "./repo/rehearsals";
import { insertRunLog } from "./repo/run-logs";
import { describeInstant, nextEvent, WEEKDAY_NAMES } from "./schedule";

export type RunOutcome =
  | { ok: true; summary: RunSummary }
  | { ok: false; status: 404 | 409 | 500; code: string; snapshotId: number | null };

export interface RunRequest {
  event: EventInfo;
  phase: Phase;
  force: boolean;
  /** The request's origin, for links in messages. */
  origin: string;
}

/** Our own line for a run that threw; the collector never writes it. */
const CRASH_ERROR = "unexpected error; see run_logs and the runtime log";

const REFUSALS = {
  running: { status: 409, code: "snapshot_running" },
  complete: { status: 409, code: "snapshot_complete" },
  "no-event": { status: 404, code: "event_not_found" },
} as const;

/** The collector threw past its own handling: the claimed row is closed as failed, with 0 calls
 * added because the real count died with the run (calls_used accumulates; a guess would lie). */
async function finaliseCrashed(
  repo: Repo,
  claim: { id: number; startedAt: Date },
  req: RunRequest,
  ctx: AppContext,
) {
  const finishedAt = ctx.now();
  const snapshotId = claim.id;
  const summary: RunSummary = {
    snapshotId,
    phase: req.phase,
    status: "failed",
    callsUsed: 0,
    quotaRemainingAfter: null,
    durationMs: finishedAt.getTime() - claim.startedAt.getTime(),
    error: CRASH_ERROR,
    stale: [],
    failed: [],
  };
  try {
    await repo.finishSnapshot(snapshotId, {
      ...summary,
      finishedAt,
      quotaRemainingBefore: null,
      boardPulledAt: null,
    });
  } catch {
    console.error("snapshot.finalise_failed", { snapshot_id: snapshotId });
  }
  return summary;
}

/**
 * Sent only after the snapshot row is final. A test event (rehearsal) never reaches the public
 * channel, its admin lines start with [TEST], and its AFTER run is followed by the verdict.
 */
async function notifyFinished(
  ctx: AppContext,
  db: Db,
  req: RunRequest,
  run: { summary: RunSummary; startedAt: Date; logWriteFailures: number },
): Promise<void> {
  const { summary } = run;
  const rows = await createRepo(db)
    .listAllianceRows(summary.snapshotId)
    .catch(() => []);
  const scheduledAt = req.phase === "before" ? req.event.beforeAt : req.event.afterAt;
  const context = {
    weekdayName: WEEKDAY_NAMES[ctx.env.EVENT_WEEKDAY] ?? "Saturday",
    allianceCount: rows.length,
    tableUrl: `${req.origin}/`,
    runUrl: `${req.origin}/admin/runs/${summary.snapshotId}`,
    eventId: req.event.id,
    logWriteFailures: run.logWriteFailures,
    scheduled: describeInstant(scheduledAt, ctx.env),
    started: describeInstant(run.startedAt, ctx.env),
  };
  const notifier = createNotifier(ctx.env, ctx.fetch);
  const test = { test: req.event.isTest };
  // INVARIANT notify.test-events-admin-only
  if (!req.event.isTest) await notifier.public(publicSnapshotMessage(summary, context));
  await notifier.admin(adminSnapshotMessage(summary, context), test);
  if (req.event.isTest && req.phase === "after") {
    const verdict = rehearsalVerdict(
      await loadVerdictInput(db, req.event.id),
      ctx.env.SNAPSHOT_WINDOW_MIN,
    );
    await notifier.admin(
      rehearsalVerdictMessage(verdict, req.event.id, `${req.origin}/admin/runs`),
      test,
    );
  }
}

export async function executeSnapshot(
  ctx: AppContext,
  db: Db,
  req: RunRequest,
): Promise<RunOutcome> {
  const repo = createRepo(db);
  let claimedId: number | null = null;
  let claimedAt = ctx.now();
  // The id the collector's compare-and-set claim returned: exactly our row, never another run's.
  const claiming: Repo = {
    ...repo,
    startSnapshot: async (eventId, phase, startedAt, expected) => {
      claimedAt = startedAt;
      return (claimedId = await repo.startSnapshot(eventId, phase, startedAt, expected));
    },
  };
  const logger = createRunLogger(
    { insertRunLog: (line) => insertRunLog(db, line) },
    { snapshotId: () => claimedId, secrets: secretsOf(ctx.env), now: ctx.now },
  );
  const deps = { v1: ctx.v1, internal: ctx.internal, repo: claiming, logger, now: ctx.now };
  let summary: RunSummary | null = null;
  let refused: RunRefusedError | null = null;
  try {
    summary = await runSnapshot(req.event.id, req.phase, deps, { force: req.force });
  } catch (e) {
    if (e instanceof RunRefusedError) refused = e;
    else await logger.error("run.crashed", { error: e instanceof Error ? e.name : "unknown" });
  } finally {
    // INVARIANT run.finalised-in-finally: a claimed row never stays `running` past the response.
    if (summary === null && claimedId !== null) {
      summary = await finaliseCrashed(repo, { id: claimedId, startedAt: claimedAt }, req, ctx);
    }
    await logger.shutdown();
  }
  if (summary === null) {
    // Nothing was claimed: either refused, or the run died before its claim (e.g. the DB is down).
    return refused
      ? { ok: false, ...REFUSALS[refused.reason], snapshotId: null }
      : { ok: false, status: 500, code: "run_failed", snapshotId: null };
  }
  await notifyFinished(ctx, db, req, {
    summary,
    startedAt: claimedAt,
    logWriteFailures: logger.stats().failedWrites,
  });
  // A refusal after the claim ('no-event') was finalised above and still answers as a refusal.
  if (refused) return { ok: false, ...REFUSALS[refused.reason], snapshotId: summary.snapshotId };
  return summary.error === CRASH_ERROR
    ? { ok: false, status: 500, code: "run_failed", snapshotId: summary.snapshotId }
    : { ok: true, summary };
}

/** Plan §3.1: quota ⚠️ under 900, database ⚠️ over 700 MB. */
export const QUOTA_WARN_BELOW = 900;
const DB_WARN_ABOVE_BYTES = 700 * 1024 * 1024;

/**
 * The Friday check: one /v1/quota call, the database size and the next snapshot times. Posts to the
 * admin channel when `always` (the tick) or when quota is low (GET /api/quota/check).
 */
export async function quotaReport(
  ctx: AppContext,
  db: Db,
  options: { always: boolean },
): Promise<{ remaining: number | null; posted: boolean }> {
  const remaining = await ctx.v1.fetchQuota().then(
    (q) => q.remaining,
    () => null,
  );
  const low = remaining === null || remaining < QUOTA_WARN_BELOW;
  if (!options.always && !low) return { remaining, posted: false };
  const bytes = await databaseSizeBytes(db);
  const event = nextEvent(ctx.now(), ctx.env);
  const lines = [
    `${low ? "⚠️" : "✅"} quota remaining: ${remaining ?? "unavailable (the /v1/quota call failed)"}`,
    `${bytes > DB_WARN_ABOVE_BYTES ? "⚠️" : "✅"} database size: ${(bytes / 1024 / 1024).toFixed(1)} MB`,
    `next BEFORE: ${describeInstant(event.beforeAt, ctx.env)}`,
    `next AFTER: ${describeInstant(event.afterAt, ctx.env)}`,
  ];
  await createNotifier(ctx.env, ctx.fetch).admin(lines.join("\n"));
  return { remaining, posted: true };
}
