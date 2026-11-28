// Issue 789's one-off /v1 discovery against PGlite with a stubbed `probePath`: it reads the 12 paths once,
// only inside 02:30–02:45 ST on Sun 2026-11-29 (outside every event and Raid Shield window), at most once
// even when two ticks overlap; it stores each answer's structure and no value, cut per path; it never sends
// more than 12 attempts, stops on a 429, keeps the squads read's reserve and gives way to a running squads
// read. Removed with lib/api-probe.ts by the follow-up PR.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID, TRACKED_COUNT } from "../config/alliances";
import {
  API_PROBE_WINDOW,
  apiProbe,
  type ApiProbeDeps,
  MANY_KEYS,
  PROBE_PATHS,
  SHAPE_MAX_CHARS,
} from "./api-probe";
import { TEST_ENV, testContext } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { saveWorkspace } from "./repo/workspaces";
import { eventsToCreate, serverInstant } from "./schedule";
import { appAlerts, dailyReads, runLogs } from "./schema";
import { squadReads } from "./schema-squads";
import { passWindows } from "./shield-check";
import type { OnAttempt, ProbeAnswer } from "./sources/types";
import { squadsReserve } from "./squads";
import { AFTER_BUDGET_MS, squadsBatch } from "./squads-tick";
import { squadsMayRun, tickMayBeDue } from "./tick-gate";

/** Sun 2026-11-29 02:30 ST (UTC−2): the probe's tick. Its quota day is Saturday's daily read. */
const AT = new Date("2026-11-29T04:30:00Z");
const DAY = "2026-11-28";
/** A value that must never be stored: a string and a number from the answer. */
const SENTINEL = "Sentinel-Wren-7731";
const SENTINEL_NUMBER = 987_654_321;

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: OWN_ALLIANCE_ID,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
  });
  await db.insert(dailyReads).values({
    day: DAY,
    startedAt: new Date(`${DAY}T23:30:00-02:00`),
    status: "complete",
    callsUsed: 21,
    quotaRemainingBefore: 900,
  });
});

const body = () => ({
  name: SENTINEL,
  power: SENTINEL_NUMBER,
  members: [{ nick_name: SENTINEL, uid: SENTINEL_NUMBER }, { nick_name: "Wren" }],
  by_server: { "325": { abbr: SENTINEL } },
  // Keyed by data: more than MANY_KEYS keys, each a name that must never become a path.
  by_name: Object.fromEntries(
    Array.from({ length: MANY_KEYS + 1 }, (_, i) => [`${SENTINEL}_${i}`, { abbr: "X" }]),
  ),
  quota: { limit: 1000, used: 1, remaining: 999 },
});

function deps(now: Date, answer: (path: string, n: number) => ProbeAnswer | null = () => null) {
  const paths: string[] = [];
  let attempts = 0;
  const d: ApiProbeDeps & { paths: string[]; at: Date; attempts: () => number } = {
    paths,
    at: now,
    attempts: () => attempts,
    now: () => d.at,
    env: { ...TEST_ENV, SAMPLE_EVERY_MIN: 15 },
    paceMs: 0,
    v1: {
      probePath: async (path: string, onAttempt?: OnAttempt) => {
        onAttempt?.(0);
        attempts++;
        paths.push(path);
        return answer(path, paths.length) ?? { status: 200, body: body(), chars: 100 };
      },
    },
  };
  return d;
}

const probe = (d: ReturnType<typeof deps>) => apiProbe(d, db, d.at.getTime() + 180_000);
const lines = async () => (await db.select().from(runLogs)).toSorted((a, b) => a.id - b.id);
const summary = async () =>
  (await lines()).filter((l) => l.code === "api.probe").map((l) => l.data);

describe("the /v1 discovery of 2026-11-29 (issue 789)", () => {
  it("opens on 2026-11-29 02:30–02:45 ST only, outside every event and Raid Shield window", async () => {
    for (const at of [
      "2026-11-29T04:29:59Z",
      "2026-11-29T04:45:00Z",
      "2026-11-28T04:30:00Z",
      "2026-12-06T04:30:00Z",
    ]) {
      const outside = deps(new Date(at));
      await probe(outside);
      expect(outside.paths).toEqual([]);
    }
    const start = serverInstant(API_PROBE_WINDOW.day, API_PROBE_WINDOW.from, TEST_ENV).getTime();
    // The latest a call can be made: the window's last instant plus the tick's whole `after` budget.
    const end =
      serverInstant(API_PROBE_WINDOW.day, API_PROBE_WINDOW.to, TEST_ENV).getTime() +
      AFTER_BUDGET_MS;
    const windows = [
      ...eventsToCreate(AT, TEST_ENV).flatMap((e) => e.windows),
      ...["2026-11-27", "2026-12-04"].flatMap((f) => {
        const w = passWindows(f, TEST_ENV);
        return [w.night, w.morning].map((p) => ({ beforeAt: p.from, afterAt: p.to }));
      }),
    ];
    for (const w of windows)
      expect(end <= w.beforeAt.getTime() || start >= w.afterAt.getTime()).toBe(true);

    const inside = deps(AT);
    await probe(inside);
    expect(inside.paths).toEqual(PROBE_PATHS);
  });

  it("runs at most once, with issue 726's claims stored", async () => {
    await db.insert(appAlerts).values([
      { id: 3, alertedAt: new Date("2026-11-23T04:30:00Z") },
      { id: 4, alertedAt: new Date("2026-11-28T04:30:00Z") },
    ]);
    const a = deps(AT);
    const b = deps(new Date(AT.getTime() + 1000));
    await Promise.all([probe(a), probe(b)]);
    expect([...a.paths, ...b.paths]).toEqual(PROBE_PATHS);
    const later = deps(new Date("2026-11-29T04:40:00Z"));
    await probe(later);
    expect(later.paths).toEqual([]);
    expect(await summary()).toEqual([expect.objectContaining({ calls: 12, paths_stored: 12 })]);
  });

  it("stores each answer's structure and no value, cut per path", async () => {
    // 40 × 40 field names (none past MANY_KEYS): about 40,000 characters of structure.
    const row = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`sub_${i}`, i]));
    const wide = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`field_${i}`, row]));
    const d = deps(AT, (path) =>
      path === "/map"
        ? { status: 200, body: wide, chars: 50_000 }
        : path === "/kvk"
          ? { status: 404, body: undefined, chars: null }
          : null,
    );
    await probe(d);
    const stored = (await lines()).filter((l) => l.code === "api.probe.path");
    expect(stored.map((l) => (l.data as { path: string }).path)).toEqual(
      PROBE_PATHS.map((p) => p.replace(/^\/players\/\d+/, "/players/[uid]")),
    );
    const text = JSON.stringify(await lines());
    for (const value of [SENTINEL, String(SENTINEL_NUMBER), "340581761349", "999"])
      expect(text).not.toContain(value);
    const first = stored[0]?.data as { status: number; shape: string };
    expect(first.status).toBe(200);
    expect(first.shape.split("\n")).toEqual(
      expect.arrayContaining([
        "$.name: string",
        "$.members: array len=2",
        "$.members[].nick_name: string",
        "$.members[].uid: number",
        "$.by_server.<numeric-key>.abbr: string",
        `$.by_name: object <many-keys n=${MANY_KEYS + 1}>`,
        "$.by_name.<many-keys>.abbr: string",
        "$.quota.remaining: number",
      ]),
    );
    const kvk = stored.find((l) => (l.data as { path: string }).path === "/kvk")?.data;
    expect(kvk).toEqual(expect.objectContaining({ status: 404, json: false, shape: null }));
    const map = (stored.find((l) => (l.data as { path: string }).path === "/map")?.data ?? {}) as {
      shape: string;
    };
    expect(map.shape).toContain("…[cut: ");
    expect(map.shape.length).toBeLessThan(SHAPE_MAX_CHARS + 50);
    expect(text.length).toBeLessThan(200_000);
  });

  it("never sends more than 12 attempts, and stops on a 429", async () => {
    // Each call reports a retry too: the 13th attempt is refused before it is sent.
    const retrying = deps(AT);
    const inner = retrying.v1.probePath;
    retrying.v1.probePath = async (path, onAttempt, signal) => {
      onAttempt?.(0);
      return inner(path, onAttempt, signal);
    };
    await probe(retrying);
    expect(retrying.paths).toHaveLength(6);
    expect(await summary()).toEqual([expect.objectContaining({ calls: 12, reason: "cap" })]);

    await truncateAll(db);
    await db.insert(dailyReads).values({
      day: DAY,
      startedAt: new Date(`${DAY}T23:30:00-02:00`),
      status: "complete",
      callsUsed: 21,
      quotaRemainingBefore: 900,
    });
    const limited = deps(AT, (_, n) => (n === 3 ? { status: 429, body: {}, chars: null } : null));
    await probe(limited);
    expect(limited.paths).toEqual(PROBE_PATHS.slice(0, 3));
    expect(await summary()).toEqual([expect.objectContaining({ calls: 3, reason: "status_429" })]);
  });

  it("stores only the error's name when a call gets no answer, and reads the next path", async () => {
    const d = deps(AT);
    const inner = d.v1.probePath;
    d.v1.probePath = async (path, onAttempt, signal) => {
      if (path !== "/servers") return inner(path, onAttempt, signal);
      onAttempt?.(0);
      throw new TypeError(`fetch failed ${SENTINEL}`);
    };
    await probe(d);
    const servers = (await lines()).find((l) => (l.data as { path: string }).path === "/servers");
    expect(servers?.data).toEqual({ path: "/servers", status: null, error: "TypeError" });
    expect(d.paths).toEqual(PROBE_PATHS.filter((p) => p !== "/servers"));
    expect(JSON.stringify(await lines())).not.toContain(SENTINEL);
    expect(await summary()).toEqual([expect.objectContaining({ calls: 12, paths_stored: 11 })]);
  });

  it("stops at the deadline", async () => {
    // Each call takes a minute of the probe's clock; the deadline is 3 minutes after the start.
    const d = deps(AT, () => {
      d.at = new Date(d.at.getTime() + 60_000);
      return null;
    });
    await probe(d);
    expect(d.paths).toEqual(PROBE_PATHS.slice(0, 3));
    expect(await summary()).toEqual([expect.objectContaining({ calls: 3, reason: "deadline" })]);
  });

  it("makes no call with no daily read, or with its quota unknown", async () => {
    await db.update(dailyReads).set({ quotaRemainingBefore: null });
    const unknown = deps(AT);
    await probe(unknown);
    expect(unknown.paths).toEqual([]);
    expect(await summary()).toEqual([
      expect.objectContaining({ calls: 0, reason: "quota_unknown" }),
    ]);

    // No daily read: no call. Its summary line cannot be stored (run_logs.read_day needs the read).
    await truncateAll(db);
    const none = deps(AT);
    await probe(none);
    expect(none.paths).toEqual([]);
  });

  it("makes no call when the 12 calls would cut into the squads read's reserve", async () => {
    const reserve = squadsReserve(AT, deps(AT).env, TRACKED_COUNT);
    await db.update(dailyReads).set({ quotaRemainingBefore: 21 + reserve + 12 - 1 });
    const d = deps(AT);
    await probe(d);
    expect(d.paths).toEqual([]);
    expect(await summary()).toEqual([expect.objectContaining({ calls: 0, reason: "quota_low" })]);
  });

  it("makes no call while the day's squads read is still running", async () => {
    await db.insert(squadReads).values({
      day: DAY,
      unionId: OWN_ALLIANCE_ID,
      status: "running",
      startedAt: new Date("2026-11-29T01:31:00Z"),
      members: 12,
      quotaRemaining: 700,
    });
    const d = deps(AT);
    await probe(d);
    expect(d.paths).toEqual([]);
    expect(await summary()).toEqual([expect.objectContaining({ calls: 0, reason: "squads_busy" })]);
  });

  it("opens the tick's gate at 04:31Z with the squads queue settled, and the tick's batch runs the probe", async () => {
    await db.insert(squadReads).values({
      day: DAY,
      unionId: OWN_ALLIANCE_ID,
      status: "done",
      startedAt: new Date("2026-11-29T01:31:00Z"),
      members: 12,
      quotaRemaining: 700,
    });
    const { ctx, clock } = testContext(db);
    clock.now = new Date("2026-11-29T04:31:00Z");
    const stub = deps(clock.now);
    ctx.v1 = { ...ctx.v1, probePath: stub.v1.probePath };
    expect(await squadsMayRun(ctx, db)).toBe(false);
    expect(await tickMayBeDue(ctx, db)).toBe(true);
    // What /api/tick's `after` runs (scheduleSquadsBatch).
    await squadsBatch(ctx, undefined, "https://laptracker.test");
    expect(stub.paths).toEqual(PROBE_PATHS);
  });
});
