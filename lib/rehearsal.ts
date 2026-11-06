// Rehearsals (plan §3.1): a test event with its own phase times that the real cron ticks run, and
// the verdict that says whether that run would have been a good scheduled event.
import { RUN_STALE_AFTER_MS } from "./collector";
import type { Db } from "./db";
import type { Env } from "./env";
import type { Phase } from "./repo";
import {
  hasPendingRehearsal,
  hasRealBeforeWithin,
  hasRealPhaseRunning,
  insertRehearsal,
  pruneRehearsals,
  type VerdictInput,
  type VerdictPhase,
} from "./repo/rehearsals";
import { nextEvent, serverWeekday } from "./schedule";

const MINUTE = 60_000;
export const REHEARSAL_BEFORE_MS = 15 * MINUTE;
export const REHEARSAL_AFTER_MS = 45 * MINUTE;
/** Plan §3.1: never within 3 h before a real event's BEFORE. */
export const REAL_BEFORE_GUARD_MS = 3 * 60 * MINUTE;
/** Plan §3.6: the function limit every run must stay under. */
const MAX_RUN_MS = 120_000;

export type RehearsalRefusal = "event-day" | "before-real" | "real-running" | "pending";

export type RehearsalResult =
  | { ok: true; eventId: number; beforeAt: Date; afterAt: Date; pruned: number[] }
  | { ok: false; reason: RehearsalRefusal };

/** The §3.1 guards, cheapest first. Null when a rehearsal may start now. */
async function refusal(db: Db, now: Date, env: Env): Promise<RehearsalRefusal | null> {
  const afterAt = new Date(now.getTime() + REHEARSAL_AFTER_MS);
  const blockedDays = [env.EVENT_WEEKDAY, (env.EVENT_WEEKDAY + 1) % 7];
  // INVARIANT rehearsal.not-on-event-days: neither its start nor its AFTER may land there.
  if ([now, afterAt].some((at) => blockedDays.includes(serverWeekday(at, env)))) {
    return "event-day";
  }
  const coming = nextEvent(now, env).beforeAt.getTime() - now.getTime();
  if (
    (coming > 0 && coming <= REAL_BEFORE_GUARD_MS) ||
    (await hasRealBeforeWithin(db, now, REAL_BEFORE_GUARD_MS))
  ) {
    return "before-real";
  }
  if (await hasRealPhaseRunning(db, now, RUN_STALE_AFTER_MS)) return "real-running";
  if (await hasPendingRehearsal(db, now, env.SNAPSHOT_WINDOW_MIN * MINUTE)) return "pending";
  return null;
}

/**
 * Creates `REHEARSAL <iso>` (is_test) with BEFORE at now + 15 min and AFTER at now + 45 min, then
 * keeps only the newest REHEARSAL_KEEP rehearsals. The /admin button and REHEARSAL_AT both use it.
 */
export async function createRehearsal(db: Db, now: Date, env: Env): Promise<RehearsalResult> {
  const reason = await refusal(db, now, env);
  if (reason) return { ok: false, reason };
  const beforeAt = new Date(now.getTime() + REHEARSAL_BEFORE_MS);
  const afterAt = new Date(now.getTime() + REHEARSAL_AFTER_MS);
  const eventId = await insertRehearsal(db, {
    name: `REHEARSAL ${now.toISOString()}`,
    // Between the phases, as a scheduled event's EVENT_TIME is; it also keeps event_at_utc unique.
    eventAtUtc: new Date(now.getTime() + (REHEARSAL_BEFORE_MS + REHEARSAL_AFTER_MS) / 2),
    beforeAt,
    afterAt,
  });
  // INVARIANT rehearsal.keep: older rehearsals and all their rows go when a new one is created.
  const pruned = await pruneRehearsals(db, env.REHEARSAL_KEEP);
  return { ok: true, eventId, beforeAt, afterAt, pruned };
}

export interface VerdictLine {
  ok: boolean;
  text: string;
}

export interface Verdict {
  pass: boolean;
  lines: VerdictLine[];
}

const PHASES: Phase[] = ["before", "after"];
const label = (a: { unionId: number; tag: string | null }) => a.tag ?? String(a.unionId);
const seconds = (ms: number | null) => (ms === null ? "unknown" : `${(ms / 1000).toFixed(1)} s`);

/** What the quota dropped by: the first response (the quota check) already counts its own call. */
function quotaSpent(p: VerdictPhase): number | null {
  if (p.quotaRemainingBefore === null || p.quotaRemainingAfter === null) return null;
  return p.quotaRemainingBefore - p.quotaRemainingAfter + 1;
}

function line(ok: boolean, good: string, bad: string): VerdictLine {
  return { ok, text: ok ? good : bad };
}

function freshLine(before: VerdictPhase, after: VerdictPhase): VerdictLine {
  const notFresh = (p: VerdictPhase) => p.alliances.filter((a) => !a.isFresh).map(label);
  const counts = PHASES.map((ph, i) => {
    const p = i === 0 ? before : after;
    return `${ph} ${p.alliances.length - notFresh(p).length}/${p.alliances.length}`;
  }).join(", ");
  const stale = [...new Set([...notFresh(before), ...notFresh(after)])];
  return line(
    stale.length === 0,
    `every alliance fresh in both (${counts})`,
    `not fresh: ${stale.join(", ")} (${counts})`,
  );
}

function advancedLine(before: VerdictPhase, after: VerdictPhase): VerdictLine {
  const earlier = new Map(before.alliances.map((a) => [a.unionId, a.sourceUpdatedAt]));
  const stuck = after.alliances.filter((a) => {
    const was = earlier.get(a.unionId);
    return !was || !a.sourceUpdatedAt || a.sourceUpdatedAt <= was;
  });
  const missing = before.alliances.filter(
    (b) => !after.alliances.some((a) => a.unionId === b.unionId),
  );
  const named = [...stuck, ...missing].map(label);
  return line(
    named.length === 0,
    `data time moved forward for every alliance (${after.alliances.length}/${before.alliances.length})`,
    `data time did not move forward: ${named.join(", ")}`,
  );
}

function perPhase(
  input: { before: VerdictPhase; after: VerdictPhase },
  test: (p: VerdictPhase) => boolean,
  show: (p: VerdictPhase) => string,
) {
  const parts = PHASES.map((ph) => ({ ph, p: input[ph] }));
  return {
    ok: parts.every(({ p }) => test(p)),
    all: parts.map(({ ph, p }) => `${ph} ${show(p)}`).join(", "),
    bad: parts
      .filter(({ p }) => !test(p))
      .map(({ ph, p }) => `${ph} ${show(p)}`)
      .join(", "),
  };
}

/**
 * The rehearsal verdict (plan §3.1). Every failed line names the alliance or the number behind it.
 * Pure: the caller loads the rows (lib/repo/rehearsals.ts loadVerdictInput).
 */
export function rehearsalVerdict(input: VerdictInput, windowMin: number): Verdict {
  const { before, after } = input;
  if (!before || !after) {
    const missing = PHASES.filter((ph) => !input[ph]).join(" and ");
    return { pass: false, lines: [{ ok: false, text: `no ${missing} snapshot` }] };
  }
  const both = { before, after };
  const complete = perPhase(
    both,
    (p) => p.status === "complete",
    (p) => p.status,
  );
  // Attempts after the last quota-bearing response are not in the drop; the run counts them.
  const accounted = (p: VerdictPhase) => {
    const spent = quotaSpent(p);
    return spent === null ? null : spent + p.quotaUnseenCalls;
  };
  const quota = perPhase(
    both,
    (p) => accounted(p) === p.callsUsed,
    (p) =>
      `${p.callsUsed} ${accounted(p) === p.callsUsed ? "=" : "≠"} ${quotaSpent(p) ?? "unknown"}${
        p.quotaUnseenCalls > 0 ? ` + ${p.quotaUnseenCalls} without quota` : ""
      }`,
  );
  const fast = perPhase(
    both,
    (p) => p.durationMs !== null && p.durationMs < MAX_RUN_MS,
    (p) => seconds(p.durationMs),
  );
  const lagMin = (p: VerdictPhase) => (p.startedAt.getTime() - p.scheduledAt.getTime()) / MINUTE;
  const onTime = perPhase(
    both,
    (p) => lagMin(p) >= 0 && lagMin(p) < windowMin,
    (p) => `+${Math.round(lagMin(p))} min`,
  );
  const lines = [
    line(complete.ok, `both snapshots complete`, `not complete: ${complete.bad}`),
    freshLine(before, after),
    advancedLine(before, after),
    line(
      quota.ok,
      `calls used = quota drop (${quota.all})`,
      `calls used ≠ quota drop: ${quota.bad}`,
    ),
    line(fast.ok, `each run under 120 s (${fast.all})`, `over 120 s: ${fast.bad}`),
    line(
      onTime.ok,
      `started within ${windowMin} min of schedule (${onTime.all})`,
      `late start: ${onTime.bad}`,
    ),
  ];
  return { pass: lines.every((l) => l.ok), lines };
}
