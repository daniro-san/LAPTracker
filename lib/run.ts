// Runs a snapshot for a route (plan Phase 4) and the Friday quota report (plan §3.1). The finally
// block exists because a serverless function is frozen once it returns: the snapshot row must be
// final and the logger's inserts settled before the response leaves, on every path.
import { secretsOf, type AppContext } from "./app-context";
import { RunRefusedError, runSnapshot, type RunSummary } from "./collector";
import type { Db } from "./db";
import { createRunLogger } from "./logger";
import { quotaReportMessage, createNotifier, discordClock } from "./notify";
import { createRepo, type Phase, type Repo } from "./repo";
import { databaseSizeBytes } from "./repo/database";
import type { EventInfo } from "./repo/events";
import { insertRunLog } from "./repo/run-logs";
import { notifyFinished } from "./run-notify";
import { nextEvent } from "./schedule";

export type RunOutcome =
  | { ok: true; summary: RunSummary }
  | {
      ok: false;
      status: 404 | 409 | 500;
      code: string;
      snapshotId: number | null;
      /** snapshot_stale: how many rows a re-read would read again (D63). */
      staleCount?: number;
    };

export interface RunRequest {
  event: EventInfo;
  phase: Phase;
  force: boolean;
  /** D63: read the stale rows again (true), keep them (false), or refuse while any exist (undefined). */
  stale?: boolean | undefined;
  /** The request's origin, for links in messages. */
  origin: string;
}

/** maxDuration is 120 s: the response leaves by this long after the run's start (D43). */
export const NOTIFY_CAP_MS = 115_000;

/** Our own line for a run that threw; the collector never writes it. */
const CRASH_ERROR = "unexpected error; see run_logs and the runtime log";

const REFUSALS = {
  running: { status: 409, code: "snapshot_running" },
  complete: { status: 409, code: "snapshot_complete" },
  "no-event": { status: 404, code: "event_not_found" },
  "not-due": { status: 409, code: "snapshot_not_due" },
  stale: { status: 409, code: "snapshot_stale" },
  "event-started": { status: 409, code: "event_started" },
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
      quotaUnseenCalls: 0,
      boardPulledAt: null,
    });
  } catch {
    console.error("snapshot.finalise_failed", { snapshot_id: snapshotId });
  }
  return summary;
}

/** INVARIANT run.answers-by-115s: notify gets what is left of NOTIFY_CAP_MS; past that it is cut,
 * as Vercel would cut the whole function at 120 s, and the caller still gets its answer. */
async function notifyWithinCap(
  ctx: AppContext,
  startedAt: Date,
  snapshotId: number,
  notified: Promise<void>,
) {
  const left = NOTIFY_CAP_MS - (ctx.now().getTime() - startedAt.getTime());
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cap = new Promise<"cut">(
    (resolve) => (timer = setTimeout(resolve, Math.max(0, left), "cut")),
  );
  try {
    if ((await Promise.race([notified, cap])) === "cut") {
      notified.catch(() => {});
      console.error("notify.cut", { snapshot_id: snapshotId });
    }
  } finally {
    clearTimeout(timer);
  }
}

/** A refusal as an outcome; a stale refusal carries the count the owner is asked about (D63). */
const refusal = (e: RunRefusedError, snapshotId: number | null): RunOutcome => ({
  ok: false,
  ...REFUSALS[e.reason],
  snapshotId,
  ...(e.staleCount !== undefined && { staleCount: e.staleCount }),
});

/** The refusals that need no claim. Not due: refused before the event's before_at, force included: a
 * weekday press would otherwise store the coming scheduled event's phase with weekday data, and the tick
 * would then skip the real run. A manual event has no schedule and the tick never runs it, so that risk
 * does not exist for it (D28). Event started (D63): a scheduled Before read again once the event has
 * started would put the event's own kills in the baseline, so its stale rows are then kept, and asking
 * for them is refused. Otherwise, the `stale` option the run gets. */
function gate(
  now: Date,
  req: RunRequest,
): { refused: "not-due" | "event-started" } | { stale: boolean | undefined } {
  if (!req.event.manual && now < req.event.beforeAt) return { refused: "not-due" };
  const started = !req.event.manual && req.phase === "before" && now >= req.event.eventAtUtc;
  if (!started) return { stale: req.stale };
  return req.stale ? { refused: "event-started" } : { stale: false };
}

export async function executeSnapshot(
  ctx: AppContext,
  db: Db,
  req: RunRequest,
): Promise<RunOutcome> {
  const gated = gate(ctx.now(), req);
  if ("refused" in gated) return { ok: false, ...REFUSALS[gated.refused], snapshotId: null };
  const { stale } = gated;
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
    summary = await runSnapshot(req.event.id, req.phase, deps, { force: req.force, stale });
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
      ? refusal(refused, null)
      : { ok: false, status: 500, code: "run_failed", snapshotId: null };
  }
  await notifyWithinCap(
    ctx,
    claimedAt,
    summary.snapshotId,
    notifyFinished(ctx, db, req, {
      summary,
      startedAt: claimedAt,
      logWriteFailures: logger.stats().failedWrites,
    }),
  );
  // A refusal after the claim ('no-event') was finalised above and still answers as a refusal.
  if (refused) return refusal(refused, summary.snapshotId);
  return summary.error === CRASH_ERROR
    ? { ok: false, status: 500, code: "run_failed", snapshotId: summary.snapshotId }
    : { ok: true, summary };
}

/** Plan §3.1: quota ⚠️ under 900, database ⚠️ over 700 MB. */
export const QUOTA_WARN_BELOW = 900;
const DB_WARN_ABOVE_MB = 700;

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
  const clock = discordClock(ctx.env.SERVER_TZ);
  const message = quotaReportMessage({
    at: clock.stamp(ctx.now()),
    remaining,
    warnBelow: QUOTA_WARN_BELOW,
    databaseMb: bytes / 1024 / 1024,
    warnAboveMb: DB_WARN_ABOVE_MB,
    beforeAt: clock.stamp(event.beforeAt),
    afterAt: clock.stamp(event.afterAt),
  });
  await createNotifier(ctx.env, ctx.fetch).admin(message);
  return { remaining, posted: true };
}
