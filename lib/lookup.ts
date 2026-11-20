// "Get today's details" (D133, issue 459): the first visitor's press on an alliance outside the daily read makes
// one /v1/alliances/{id} read for the whole site that server day, on LAP_API_KEY, without `fresh` (the
// tracker's cached copy). The roster is stored as a daily roster of that day (D72), so every later visitor
// sees it. Refused inside the scheduled event's window (D69), past LOOKUPS_PER_DAY claims, and when the
// read would leave less than D117's reserve (SQUADS_SAFETY_MARGIN plus the event's reads on its quota day).
// At most two calls: one /quota call and the read, neither retried, each cut at LOOKUP_CALL_TIMEOUT_MS, so the
// lookup ends well inside the route's maxDuration (30 s). A claim a killed function left "running" reads as
// failed after LOOKUP_STALE_AFTER_MS (lib/repo/alliance-lookups.ts).
import { LOOKUPS_PER_DAY, TRACKED_COUNT } from "../config/alliances";
import { dataRow } from "./daily-rows";
import type { Db } from "./db";
import type { Env } from "./env";
import { claimLookup, finishLookup, type QuotaGate } from "./repo/alliance-lookups";
import { isKnownAlliance } from "./repo/alliances";
import { storeDailyRoster } from "./repo/daily-reads";
import { recordFrames } from "./repo/player-frames";
import { inEventWindow, serverDay } from "./schedule";
import type { V1Source } from "./sources/types";
import { squadsReserve } from "./squads";
import { describe } from "./upstream-errors";
import { dailyIds } from "./workspace-keys";

/** Presses per address (the route counts them first): enough for a few alliances, not for a loop. */
export const LOOKUP_IP_LIMIT = 5;
export const LOOKUP_IP_WINDOW_MS = 15 * 60_000;

/** Each call's own timeout, never retried: two calls and the writes stay far inside the route's 30 s. */
export const LOOKUP_CALL_TIMEOUT_MS = 10_000;
const CALL = { maxRetries: 0, timeoutMs: LOOKUP_CALL_TIMEOUT_MS };

/** The tracker keeps its cached copy up to 60 minutes (D64), so a lookup's roster is fresh within that. */
export const LOOKUP_FRESH_MAX_AGE_MS = 60 * 60_000;

export type LookupCode =
  "done" | "unknown" | "daily" | "event_window" | "taken" | "cap" | "quota" | "failed";

type Deps = { v1: V1Source; now: () => Date; env: Env };

/**
 * One press. "done" stored the roster; "taken" another press got the day's claim first; the others refuse
 * with no call ("unknown", "daily", "event_window", "cap") or after the claim ("quota", "failed"), which
 * keeps the day's claim: the alliance waits until tomorrow.
 */
export async function lookupAlliance(deps: Deps, db: Db, unionId: number): Promise<LookupCode> {
  const now = deps.now();
  const day = serverDay(now, deps.env);
  if (!(await isKnownAlliance(db, unionId))) return "unknown";
  const daily = await dailyIds(db, day, deps.env.WORKSPACE_KEYS_SECRET, now);
  if (daily.includes(unionId)) return "daily";
  // INVARIANT lookups.not-in-event-window
  if (inEventWindow(now, deps.env)) return "event_window";
  const reserve = squadsReserve(now, deps.env, TRACKED_COUNT);
  // INVARIANT lookups.keeps-event-reserve: inside the claim's lock, this read and every lookup still in
  // flight, then D117's reserve, must fit in what the quota call says.
  const gate: QuotaGate = async (inFlight) => {
    try {
      const { remaining } = await deps.v1.fetchQuota(undefined, undefined, CALL);
      return { ok: remaining - 1 - inFlight >= reserve, remaining };
    } catch (e) {
      return { ok: false, remaining: null, error: `v1 ${describe(e)}` };
    }
  };
  const claim = await claimLookup(db, { unionId, day }, now, LOOKUPS_PER_DAY, gate);
  if (claim.code === "refused") {
    console.info("lookup.refused", { reason: "quota", quota_remaining: claim.remaining });
    return "quota";
  }
  if (claim.code !== "claimed") return claim.code;
  const finish = (status: "done" | "failed", quotaRemaining: number | null, error: string | null) =>
    finishLookup(db, unionId, day, {
      status,
      finishedAt: deps.now(),
      callsUsed: 2,
      quotaRemaining,
      error,
    });
  try {
    const a = await deps.v1.fetchAlliance(unionId, undefined, undefined, { ...CALL, fresh: false });
    await storeDailyRoster(db, day, dataRow(a, deps.now(), LOOKUP_FRESH_MAX_AGE_MS));
    await recordFrames(db, a.members, a.sourceUpdatedAt);
    await finish("done", a.quota?.remaining ?? claim.remaining, null);
    console.info("lookup.done", { quota_remaining: a.quota?.remaining ?? null });
    return "done";
  } catch (e) {
    await finish("failed", claim.remaining, `v1 ${describe(e)}`);
    console.warn("lookup.failed", { code: describe(e) });
    return "failed";
  }
}
