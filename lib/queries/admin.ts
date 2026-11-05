// Read models for /admin (plan Phase 4): runs, a run's log timeline, grouped app errors and the
// latest rehearsal. Never linked from public pages; the pages check the admin cookie first.
import { asc, desc, eq, isNotNull } from "drizzle-orm";

import type { Db } from "../db";
import { rehearsalVerdict, type Verdict } from "../rehearsal";
import { loadVerdictInput } from "../repo/rehearsals";
import { allianceSnapshots, appErrors, events, runLogs, snapshots } from "../schema";

export interface ManualEventStatus {
  id: number;
  name: string;
  visibility: "admin" | "standalone" | "history";
  postPublic: boolean;
  /** One entry per phase that has a snapshot; the name can be edited once there is one. */
  phases: { phase: "before" | "after"; status: string; callsUsed: number }[];
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
    .select({ phase: snapshots.phase, status: snapshots.status, callsUsed: snapshots.callsUsed })
    .from(snapshots)
    .where(eq(snapshots.eventId, event.id));
  return { ...event, phases };
}

export async function listRuns(db: Db, limit = 60) {
  return db
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
  const tags = await db
    .select({ unionId: allianceSnapshots.unionId, tag: allianceSnapshots.tag })
    .from(allianceSnapshots)
    .where(eq(allianceSnapshots.snapshotId, snapshotId));
  return { run, logs, tags: new Map(tags.map((t) => [t.unionId, t.tag])) };
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
