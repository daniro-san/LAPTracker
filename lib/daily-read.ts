// The daily roster read (D60, issue 197): once a day the tick reads DAILY_ROSTER_IDS through /v1 and stores
// each roster as uid/name/power/kills arrays, for the member history page. It is not an event: no events
// row, no snapshot, no Discord message beyond one admin line when it falls short. No internal fallback
// (D5 covers event snapshots only): a missed alliance is a gap in the history.
import { ALLIANCES } from "../config/alliances";
import { dailyReadQuota } from "./budget";
import { MAX_UPSTREAM_CALLS, RUN_DEADLINE_MS } from "./collector";
import { failedList, FRESH_MAX_AGE_MS } from "./collector-rows";
import { isFresh, RUN_STALE_AFTER_MS } from "./compute";
import type { Db } from "./db";
import {
  claimDailyRead,
  finishDailyRead,
  insertDailyRoster,
  reclaimDailyRead,
  type DailyReadStatus,
  type NewDailyRoster,
} from "./repo/daily-reads";
import { QuotaExhaustedError, type AllianceSnapshotInput, type V1Source } from "./sources/types";
import { describe } from "./upstream-errors";

const CONCURRENCY = 4;

export interface DailyReadSummary {
  day: string;
  status: DailyReadStatus;
  callsUsed: number;
  error: string | null;
  failed: { unionId: number; tag: string | null; error: string }[];
  stale: { unionId: number; tag: string | null }[];
}

class CallCapError extends Error {
  override name = "CallCapError";
}

const tagOf = (unionId: number) => ALLIANCES.find((a) => a.unionId === unionId)?.tag ?? null;

function dataRow(a: AllianceSnapshotInput, now: Date): NewDailyRoster {
  return {
    unionId: a.unionId,
    tag: a.tag,
    name: a.name,
    memberCount: a.memberCount,
    totalPower: a.totalPower,
    totalKills: a.totalKills,
    badgeId: a.badgeId ?? null,
    sourceUpdatedAt: a.sourceUpdatedAt,
    // INVARIANT freshness.20-min: the same rule as event snapshots.
    isFresh: isFresh(now, a.sourceUpdatedAt, FRESH_MAX_AGE_MS),
    error: null,
    memberUids: a.members.map((m) => m.uid),
    memberNames: a.members.map((m) => m.name),
    // Arrays keep a null power or kills as null (D15); Drizzle types the elements as numbers.
    memberPower: a.members.map((m) => m.power) as number[],
    memberKills: a.members.map((m) => m.kills) as number[],
  };
}

const errorRow = (unionId: number, error: string): NewDailyRoster => ({
  unionId,
  tag: tagOf(unionId),
  isFresh: false,
  error,
  memberUids: [],
  memberNames: [],
  memberPower: [],
  memberKills: [],
});

type Deps = { v1: V1Source; now: () => Date };

interface Read {
  deps: Deps;
  controller: AbortController;
  calls: number;
  abort: string | null;
  remaining: number | null;
  rows: NewDailyRoster[];
}

/** INVARIANT calls.max-upstream: every /v1 attempt, quota check and retries included. */
const attemptHook = (read: Read) => () => {
  if (read.calls >= MAX_UPSTREAM_CALLS) throw new CallCapError("MAX_UPSTREAM_CALLS reached");
  read.calls++;
};

/** The quota check, then the rosters; returns the reason the read stopped short, else null. */
async function readRosters(read: Read, ids: readonly number[]): Promise<string | null> {
  const { v1, now } = read.deps;
  const onAttempt = attemptHook(read);
  try {
    read.remaining = (await v1.fetchQuota(onAttempt, read.controller.signal)).remaining;
  } catch (e) {
    return `quota: ${describe(e)}`;
  }
  // INVARIANT budget.daily-keeps-event-reserve
  const needed = dailyReadQuota(ids.length, ALLIANCES.length);
  if (read.remaining < needed) return `quota: remaining ${read.remaining} < required ${needed}`;
  const queue = [...ids];
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined && read.abort === null; id = queue.shift()) {
      try {
        const a = await v1.fetchAlliance(id, onAttempt, read.controller.signal);
        if (read.abort === null) read.rows.push(dataRow(a, now()));
      } catch (e) {
        if (read.controller.signal.aborted) return;
        if (e instanceof QuotaExhaustedError || e instanceof CallCapError) {
          read.abort ??= describe(e);
          return;
        }
        read.rows.push(errorRow(id, `v1 ${describe(e)}`));
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return read.abort;
}

/** INVARIANT run.deadline-100s: past this no read starts and in-flight reads are cut. */
async function withDeadline(read: Read, work: Promise<string | null>): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<string>((resolve) => {
    timer = setTimeout(() => {
      read.abort ??= "deadline";
      read.controller.abort();
      resolve("deadline");
    }, RUN_DEADLINE_MS);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads the day's rosters once. Returns null when another caller already claimed the day. The run is
 * bounded like an event snapshot: MAX_UPSTREAM_CALLS, the 100 s deadline, a 429 stops it.
 */
export async function runDailyRead(
  deps: Deps,
  db: Db,
  day: string,
  ids: readonly number[],
): Promise<DailyReadSummary | null> {
  if (!(await claimDailyRead(db, day, deps.now()))) return null;
  return readDay(deps, db, day, ids);
}

/** /admin's retry: the same read again for a day that failed, or that was left `running` past
 * RUN_STALE_AFTER_MS (the function was killed). Null for any other day (no read, running, complete,
 * partial) or when another press took it first. */
export async function retryDailyRead(
  deps: Deps,
  db: Db,
  day: string,
  ids: readonly number[],
): Promise<DailyReadSummary | null> {
  const now = deps.now();
  // INVARIANT run.stale-after-150s: the snapshots' rule for a killed run.
  const staleBefore = new Date(now.getTime() - RUN_STALE_AFTER_MS);
  if (!(await reclaimDailyRead(db, day, now, staleBefore))) return null;
  return readDay(deps, db, day, ids);
}

async function readDay(
  deps: Deps,
  db: Db,
  day: string,
  ids: readonly number[],
): Promise<DailyReadSummary> {
  const read: Read = {
    deps,
    controller: new AbortController(),
    calls: 0,
    abort: null,
    remaining: null,
    rows: [],
  };
  const error = await withDeadline(read, readRosters(read, ids));
  const rows = [...read.rows];
  for (const row of rows) await insertDailyRoster(db, day, row);
  const ok = rows.filter((r) => r.error === null);
  const status: DailyReadStatus =
    ok.length === 0
      ? "failed"
      : error === null && ok.length === ids.length && ok.every((r) => r.isFresh)
        ? "complete"
        : "partial";
  await finishDailyRead(db, day, {
    status,
    finishedAt: deps.now(),
    callsUsed: read.calls,
    quotaRemainingBefore: read.remaining,
    error,
  });
  // Error rows, then the alliances the read never reached (deadline, 429, call cap, quota rule),
  // named as the collector names them, so the admin line accounts for every alliance.
  const failed = failedList(
    rows.map((r) => ({
      unionId: r.unionId,
      tag: r.tag ?? null,
      isFresh: r.isFresh,
      error: r.error ?? null,
    })),
    [...ids],
    error,
  );
  return {
    day,
    status,
    callsUsed: read.calls,
    error,
    failed,
    stale: ok.filter((r) => !r.isFresh).map((r) => ({ unionId: r.unionId, tag: r.tag ?? null })),
  };
}
