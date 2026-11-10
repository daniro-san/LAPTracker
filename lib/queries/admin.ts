// Read models for /admin (plan Phase 4): runs, a run's log timeline, grouped app errors and the
// latest rehearsal. Never linked from public pages; the pages check the admin cookie first.
import { and, asc, desc, eq, gt, isNotNull } from "drizzle-orm";

import { RUN_STALE_AFTER_MS } from "../compute";
import type { Db } from "../db";
import { rehearsalVerdict, type Verdict } from "../rehearsal";
import { runProblems } from "./run-problems";
import { loadVerdictInput } from "../repo/rehearsals";
import { allianceSnapshots, appErrors, events, runLogs, snapshots, tickLog } from "../schema";

export interface ManualEventStatus {
  id: number;
  name: string;
  visibility: "admin" | "standalone" | "history";
  postPublic: boolean;
  /** One entry per phase that has a snapshot; the name can be edited once there is one. */
  phases: {
    phase: "before" | "after";
    status: string;
    callsUsed: number;
    startedAt: Date;
    finishedAt: Date | null;
    error: string | null;
  }[];
}

/** The newest manual event (D28) and the state of its two phases; null when none was created. */
export async function latestManualEvent(db: Db): Promise<ManualEventStatus | null> {
  const [event] = await db
    .select({
      id: events.id,
      name: events.name,
      visibility: events.visibility,
      postPublic: events.postPublic,
    })
    .from(events)
    .where(eq(events.manual, true))
    .orderBy(desc(events.id))
    .limit(1);
  if (!event) return null;
  const phases = await db
    .select({
      phase: snapshots.phase,
      status: snapshots.status,
      callsUsed: snapshots.callsUsed,
      startedAt: snapshots.startedAt,
      finishedAt: snapshots.finishedAt,
      error: snapshots.error,
    })
    .from(snapshots)
    .where(eq(snapshots.eventId, event.id));
  return { ...event, phases };
}

export interface RunningSnapshot {
  id: number;
  eventName: string;
  manual: boolean;
  isTest: boolean;
  eventAtUtc: Date;
  phase: "before" | "after";
  startedAt: Date;
}

/** The newest ticks (D45), newest first: when each started and what it did (null: no end yet). */
export async function recentTicks(db: Db, limit = 5) {
  return db
    .select({ startedAt: tickLog.startedAt, outcome: tickLog.outcome })
    .from(tickLog)
    .orderBy(desc(tickLog.id))
    .limit(limit);
}

/** The snapshots running right now, whoever started them (the tick, a button, a rehearsal). */
export async function runningSnapshots(db: Db, now: Date): Promise<RunningSnapshot[]> {
  return db
    .select({
      id: snapshots.id,
      eventName: events.name,
      manual: events.manual,
      isTest: events.isTest,
      eventAtUtc: events.eventAtUtc,
      phase: snapshots.phase,
      startedAt: snapshots.startedAt,
    })
    .from(snapshots)
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(
      and(
        eq(snapshots.status, "running"),
        gt(snapshots.startedAt, new Date(now.getTime() - RUN_STALE_AFTER_MS)),
      ),
    )
    .orderBy(asc(snapshots.startedAt));
}

/** D25: a run the 100 s deadline closed carries `error = "deadline"`. */
const DEADLINE_ERROR = "deadline";

export async function listRuns(db: Db, limit = 60) {
  const rows = await db
    .select({
      id: snapshots.id,
      eventId: events.id,
      eventName: events.name,
      eventAtUtc: events.eventAtUtc,
      isTest: events.isTest,
      manual: events.manual,
      phase: snapshots.phase,
      status: snapshots.status,
      startedAt: snapshots.startedAt,
      finishedAt: snapshots.finishedAt,
      durationMs: snapshots.durationMs,
      callsUsed: snapshots.callsUsed,
      quotaRemainingAfter: snapshots.quotaRemainingAfter,
      error: snapshots.error,
    })
    .from(snapshots)
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .orderBy(desc(snapshots.startedAt))
    .limit(limit);
  const problems = await runProblems(
    db,
    rows.map((r) => r.id),
  );
  return rows.map((r) => ({
    ...r,
    deadline: r.error === DEADLINE_ERROR,
    problems: problems.filter((p) => p.snapshotId === r.id),
  }));
}

/** The data requests left after the newest run that reported them (moved off the public page, 7b). */
export async function latestQuota(db: Db) {
  const [row] = await db
    .select({ remaining: snapshots.quotaRemainingAfter, at: snapshots.startedAt })
    .from(snapshots)
    .where(isNotNull(snapshots.quotaRemainingAfter))
    .orderBy(desc(snapshots.startedAt))
    .limit(1);
  return row ?? null;
}

export async function getRun(db: Db, snapshotId: number) {
  const [run] = await db
    .select({
      id: snapshots.id,
      eventName: events.name,
      eventAtUtc: events.eventAtUtc,
      isTest: events.isTest,
      manual: events.manual,
      phase: snapshots.phase,
      status: snapshots.status,
      startedAt: snapshots.startedAt,
      finishedAt: snapshots.finishedAt,
      durationMs: snapshots.durationMs,
      callsUsed: snapshots.callsUsed,
      error: snapshots.error,
    })
    .from(snapshots)
    .innerJoin(events, eq(events.id, snapshots.eventId))
    .where(eq(snapshots.id, snapshotId));
  if (!run) return null;
  const logs = await db
    .select({
      id: runLogs.id,
      at: runLogs.at,
      level: runLogs.level,
      code: runLogs.code,
      unionId: runLogs.unionId,
      data: runLogs.data,
    })
    .from(runLogs)
    .where(eq(runLogs.snapshotId, snapshotId))
    .orderBy(asc(runLogs.at), asc(runLogs.id));
  const tagRows = await db
    .select({ unionId: allianceSnapshots.unionId, tag: allianceSnapshots.tag })
    .from(allianceSnapshots)
    .where(eq(allianceSnapshots.snapshotId, snapshotId));
  const tags = new Map(tagRows.map((t) => [t.unionId, t.tag]));
  return {
    run: { ...run, deadline: run.error === DEADLINE_ERROR },
    logs,
    tags,
    problems: await runProblems(db, [snapshotId]),
    trace: runTrace(logs, tags, run.startedAt),
  };
}

export interface TraceCall {
  /** The `v1.fetch` line's id. */
  id: number;
  endpoint: "quota" | "alliance";
  /** The alliance's tag (its union id when the run stored no tag); null for the quota call. */
  alliance: string | null;
  seconds: number | null;
  httpStatus: number | null;
  cached: boolean | null;
  /** `v1.retry` lines for the same alliance; for the quota call, the lines with no union id (one
   * quota call per run). */
  retries: number;
  slowest: boolean;
}

export interface RunTrace {
  calls: TraceCall[];
  total: { calls: number; seconds: number; retries: number };
}

interface TraceLog {
  id: number;
  at: Date;
  code: string;
  unionId: number | null;
  data: unknown;
}

const num = (v: unknown): number | null => (typeof v === "number" ? v : null);

/**
 * One line per upstream call (`v1.fetch`) of the run's latest attempt, in time order. A forced re-run
 * keeps the snapshot id, so lines from before `startedAt` belong to an earlier attempt and are left
 * out. A call the deadline cut wrote no line (D25) and is not here.
 */
export function runTrace(
  logs: readonly TraceLog[],
  tags: ReadonlyMap<number, string | null>,
  startedAt: Date,
): RunTrace {
  const own = logs.filter((l) => l.at >= startedAt);
  const retries = new Map<number | null, number>();
  for (const l of own) {
    if (l.code === "v1.retry") retries.set(l.unionId, (retries.get(l.unionId) ?? 0) + 1);
  }
  const calls: TraceCall[] = own
    .filter((l) => l.code === "v1.fetch")
    .map((l) => {
      const d = (l.data ?? {}) as Record<string, unknown>;
      const ms = num(d.duration_ms);
      const quota = d.endpoint === "quota";
      return {
        id: l.id,
        endpoint: quota ? "quota" : "alliance",
        alliance: quota || l.unionId === null ? null : (tags.get(l.unionId) ?? String(l.unionId)),
        seconds: ms === null ? null : ms / 1000,
        httpStatus: num(d.http_status),
        cached: typeof d.cached === "boolean" ? d.cached : null,
        retries: retries.get(quota ? null : l.unionId) ?? 0,
        slowest: false,
      };
    });
  const slowest = calls.reduce<TraceCall | null>(
    (max, c) => (c.seconds !== null && (max === null || c.seconds > (max.seconds ?? 0)) ? c : max),
    null,
  );
  if (slowest && calls.length > 1) slowest.slowest = true;
  return {
    calls,
    total: {
      calls: calls.length,
      seconds: calls.reduce((sum, c) => sum + (c.seconds ?? 0), 0),
      retries: calls.reduce((sum, c) => sum + c.retries, 0),
    },
  };
}

export interface ErrorGroup {
  key: string;
  digest: string | null;
  route: string;
  message: string;
  count: number;
  firstAt: Date;
  lastAt: Date;
}

/** app_errors grouped by Next's digest (route + message when it has none), newest first. */
export async function listErrorGroups(db: Db): Promise<ErrorGroup[]> {
  const rows = await db.select().from(appErrors).orderBy(desc(appErrors.at));
  const groups = new Map<string, ErrorGroup>();
  for (const r of rows) {
    const key = r.digest ?? `${r.route}\n${r.message}`;
    const group = groups.get(key);
    if (!group) {
      groups.set(key, { key, ...r, count: 1, firstAt: r.at, lastAt: r.at });
      continue;
    }
    group.count += 1;
    group.firstAt = r.at;
  }
  return [...groups.values()];
}

export interface RehearsalStatus {
  id: number;
  name: string;
  eventAtUtc: Date;
  beforeAt: Date;
  afterAt: Date;
  phases: { phase: "before" | "after"; status: string; error: string | null }[];
  verdict: Verdict | null;
}

/** The newest rehearsal: its phase statuses, and the verdict once both phases have a snapshot. */
export async function latestRehearsal(db: Db, windowMin: number): Promise<RehearsalStatus | null> {
  const [event] = await db
    .select({
      id: events.id,
      name: events.name,
      eventAtUtc: events.eventAtUtc,
      beforeAt: events.beforeAt,
      afterAt: events.afterAt,
    })
    .from(events)
    .where(eq(events.isTest, true))
    .orderBy(desc(events.id))
    .limit(1);
  if (!event) return null;
  const phases = await db
    .select({ phase: snapshots.phase, status: snapshots.status, error: snapshots.error })
    .from(snapshots)
    .where(eq(snapshots.eventId, event.id));
  const done = phases.length === 2 && phases.every((p) => p.status !== "running");
  const verdict = done ? rehearsalVerdict(await loadVerdictInput(db, event.id), windowMin) : null;
  return { ...event, phases, verdict };
}
