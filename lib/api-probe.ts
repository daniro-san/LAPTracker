// Issue 789: a one-off discovery read of the tracker's /v1 API (owner, 2026-11-28; D5, amendment 2026-11-28).
// On the tick that falls in 02:30–02:45 ST on Sun 2026-11-29, each of the 12 paths of PROBE_PATHS is read
// once, in order, on LAP_API_KEY, paced like the squads read: at most 12 calls, and none after a 401, 403 or
// 429. For each path one `api.probe.path` run-log line keeps its status and its JSON structure only: key
// paths, types and array lengths, never a value. One `api.probe` line ends the run with counts and a reason.
// The window is outside every event window and both Raid Shield check windows. It keeps the squads read's
// reserve and makes no call while the day's squads read is still running. The `app_alerts` claim (id
// API_PROBE_ALERT) makes it run at most once.
// REMOVE: a follow-up PR deletes this file, its test, its call in lib/squads-tick.ts, its gate line in
// lib/tick-gate.ts and `probePath` in lib/sources (issue 789).
import { OWN_ALLIANCE_ID, TRACKED_COUNT } from "../config/alliances";
import type { Db } from "./db";
import { opponentReserve } from "./kvk-reserve";
import { createRunLogger, type RunLogger } from "./logger";
import { claimAlert } from "./repo/app-errors";
import { getDailyRead } from "./repo/daily-reads";
import { insertRunLog } from "./repo/run-logs";
import { getSquadRead } from "./repo/squads";
import { quotaDayRead, serverInstant } from "./schedule";
import type { V1Source } from "./sources/types";
import { squadsReserve } from "./squads";
import { PACE_MS, type SquadsDeps } from "./squads-read";

/** The probe's one window, in server time (issue 789, owner 2026-11-28). Removed by the follow-up PR. */
export const API_PROBE_WINDOW = { day: "2026-11-29", from: "02:30", to: "02:45" } as const;

/**
 * The probe's claim row in `app_alerts` (1: retired, 2: the tick-silence alert, 3 and 4: issue 726's probe
 * reads of 2026-11-23 and 2026-11-28). A fresh id, so no earlier claim can refuse it.
 */
export const API_PROBE_ALERT = 5;

/** The owner's 12 paths, on the /v1 base URL (LAP_API_BASE_URL), in call order. */
export const PROBE_PATHS = [
  "/alliances/67111155",
  "/players/340581761349",
  "/alliances/325/FGH",
  "/openapi.json",
  "/servers",
  "/servers/325",
  "/rankings",
  "/events",
  "/kvk",
  "/map",
  "/players",
  "/alliances",
] as const;

/** The most upstream attempts the probe sends, retries included (`probePath` sends none). */
export const PROBE_CALLS_MAX = PROBE_PATHS.length;

/** Each path's stored structure is cut at this many characters: 12 × 16,000 stays under 200 KB. */
export const SHAPE_MAX_CHARS = 16_000;

/** An answer after which no further call is made: the key is refused, or the quota is spent. */
const STOP_STATUS = new Set([401, 403, 429]);

export interface ApiProbeDeps {
  v1: Pick<V1Source, "probePath">;
  now: () => Date;
  env: SquadsDeps["env"];
  secrets?: readonly string[];
  /** Tests pass 0. */
  paceMs?: number;
}

/** Whether `now` is inside the probe's window. */
export function apiProbeDue(now: Date, cfg: Parameters<typeof serverInstant>[2]): boolean {
  const from = serverInstant(API_PROBE_WINDOW.day, API_PROBE_WINDOW.from, cfg);
  const to = serverInstant(API_PROBE_WINDOW.day, API_PROBE_WINDOW.to, cfg);
  return now >= from && now < to;
}

type Shape = Map<string, { types: Set<string>; lens?: number[] }>;

/** The key as a path keeps it: a number becomes `<numeric-key>`, anything not a plain name `<other-key>`. */
const keyName = (k: string) =>
  /^[0-9]+$/.test(k)
    ? "<numeric-key>"
    : /^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(k)
      ? k
      : "<other-key>";

/** Every key path of `v` with the types seen there and, for an array, its lengths. No value is kept. */
export function shape(v: unknown, path = "$", acc: Shape = new Map()): Shape {
  const type = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
  const entry = acc.get(path) ?? { types: new Set<string>() };
  entry.types.add(type);
  acc.set(path, entry);
  if (Array.isArray(v)) {
    entry.lens = [...(entry.lens ?? []), v.length];
    for (const el of v) shape(el, `${path}[]`, acc);
  } else if (type === "object") {
    for (const [k, x] of Object.entries(v as object)) shape(x, `${path}.${keyName(k)}`, acc);
  }
  return acc;
}

/** One line per key path: `$.a[].b: number|null len=min 0 max 3 (n=12)`. */
export function render(acc: Shape): string {
  return [...acc.entries()]
    .map(([p, { types, lens }]) => {
      const len = !lens
        ? ""
        : lens.length === 1
          ? ` len=${lens[0]}`
          : ` len=min ${Math.min(...lens)} max ${Math.max(...lens)} (n=${lens.length})`;
      return `${p}: ${[...types].sort().join("|")}${len}`;
    })
    .join("\n");
}

const cut = (s: string) =>
  s.length <= SHAPE_MAX_CHARS
    ? s
    : `${s.slice(0, SHAPE_MAX_CHARS)}\n…[cut: ${s.length - SHAPE_MAX_CHARS} more characters]`;

/** The path as the run log names it: a player's uid never is (D115, 2026-11-21). */
const shownPath = (path: string) => path.replace(/^\/players\/\d+/, "/players/[uid]");

/**
 * The probe: claimed once, then the 12 paths until a stop or `deadline` (epoch ms). Run-log lines only; the
 * console gets one count line.
 */
export async function apiProbe(deps: ApiProbeDeps, db: Db, deadline: number): Promise<void> {
  const now = deps.now();
  if (!apiProbeDue(now, deps.env)) return;
  // One statement, so two overlapping ticks never both win.
  if (!(await claimAlert(db, API_PROBE_ALERT, now, 7 * 86_400_000))) return;
  const day = quotaDayRead(now, deps.env);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(0, deadline - now.getTime()));
  const log = createRunLogger(
    { insertRunLog: (line) => insertRunLog(db, line) },
    { readDay: day, secrets: [...(deps.secrets ?? [])], now: deps.now },
  );
  try {
    const start = await startProbe(deps, db, day);
    const run = start.reason
      ? { calls: 0, stored: 0, stop: start.reason }
      : await callAll(deps, log, { signal: controller.signal, deadline });
    console.info("api.probe", { calls: run.calls, stored: run.stored });
    const data = {
      calls: run.calls,
      paths_stored: run.stored,
      quota_remaining_before: start.remaining,
      ...(run.stop && { reason: run.stop }),
    };
    await log[run.stop ? "warn" : "info"]("api.probe", data);
  } finally {
    clearTimeout(timer);
    await log.shutdown();
  }
}

/**
 * The quota the probe starts from, as the squads read's start on our key: what the own alliance's squads read
 * (or the daily read) left. The probe's 12 calls must fit above the squads read's reserve (`squadsReserve`,
 * with the event's reads when one falls on the quota day). While the day's squads read is still running after
 * this tick's batch, `squads_busy` and no call at all.
 */
async function startProbe(deps: ApiProbeDeps, db: Db, day: string) {
  const daily = await getDailyRead(db, day);
  if (!daily) return { remaining: null, reason: "no_daily" };
  const squads = await getSquadRead(db, day, OWN_ALLIANCE_ID);
  if (squads?.status === "running") return { remaining: null, reason: "squads_busy" };
  const before = daily.quotaRemainingBefore;
  const remaining = squads?.quotaRemaining ?? (before === null ? null : before - daily.callsUsed);
  if (remaining === null) return { remaining, reason: "quota_unknown" };
  const now = deps.now();
  const reserve = squadsReserve(
    now,
    deps.env,
    TRACKED_COUNT,
    await opponentReserve(db, now, deps.env),
  );
  return { remaining, reason: remaining - PROBE_CALLS_MAX < reserve ? "quota_low" : null };
}

/** The paths in order, sequential and paced; one `api.probe.path` line each. */
async function callAll(
  deps: ApiProbeDeps,
  log: RunLogger,
  run: { signal: AbortSignal; deadline: number },
) {
  let calls = 0;
  let stored = 0;
  // Every attempt is counted before it is sent; past the cap it throws, so that attempt is not sent.
  const capped = new Error("probe cap");
  const onAttempt = () => {
    if (calls >= PROBE_CALLS_MAX) throw capped;
    calls++;
  };
  for (const [i, path] of PROBE_PATHS.entries()) {
    if (calls >= PROBE_CALLS_MAX) return { calls, stored, stop: "cap" };
    if (run.signal.aborted || deps.now().getTime() >= run.deadline)
      return { calls, stored, stop: "deadline" };
    try {
      const answer = await deps.v1.probePath(path, onAttempt, run.signal);
      const json = answer.body !== undefined;
      await log.info("api.probe.path", {
        path: shownPath(path),
        status: answer.status,
        chars: answer.chars,
        json,
        shape: json ? cut(render(shape(answer.body))) : null,
      });
      stored++;
      if (STOP_STATUS.has(answer.status)) return { calls, stored, stop: `status_${answer.status}` };
    } catch (e) {
      if (run.signal.aborted) return { calls, stored, stop: "deadline" };
      if (e === capped) return { calls, stored, stop: "cap" };
      // No HTTP answer: the error's name only (TimeoutError, TypeError), never its text.
      const error = e instanceof Error ? e.name : "Error";
      await log.warn("api.probe.path", { path: shownPath(path), status: null, error });
    }
    if (i < PROBE_PATHS.length - 1)
      await new Promise((resolve) => setTimeout(resolve, deps.paceMs ?? PACE_MS));
  }
  return { calls, stored, stop: null };
}
