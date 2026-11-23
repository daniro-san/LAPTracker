// Issue 726's one-off probe read against PGlite with a stubbed /v1/players: it reads the own alliance once,
// only inside 02:30–02:45 ST on Sat 2026-11-28, at most once even when two ticks overlap and Monday's claim
// is stored; it writes no mark, posts nothing, leaves the Raid Shield check's row as it was, and its
// readings fall in neither check's window; it keeps the morning check's calls and gives way to a running
// squads read. Removed with lib/shield-probe.ts by the follow-up PR.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID, TRACKED_COUNT } from "../config/alliances";
import { TEST_ENV, testContext } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { shieldReadings } from "./repo/shield-checks";
import { saveWorkspace } from "./repo/workspaces";
import { serverInstant } from "./schedule";
import { appAlerts, dailyReads, dailyRosters, runLogs } from "./schema";
import { memberFacts } from "./schema-facts";
import { rollCallMarks } from "./schema-rollcall";
import { shieldChecks } from "./schema-shield";
import { playerReads, squadReads } from "./schema-squads";
import { fridayOf, passWindows, SHIELD_CALLS_MAX } from "./shield-check";
import { PROBE_WINDOW, shieldProbe } from "./shield-probe";
import { squadsReserve } from "./squads";
import type { SquadsDeps } from "./squads-read";
import { AFTER_BUDGET_MS, squadsBatch } from "./squads-tick";
import { playerAnswer } from "./squads.test-helpers";
import { squadsMayRun, tickMayBeDue } from "./tick-gate";

/** Sat 2026-11-28 02:30 ST (UTC−2): the probe's tick. Its quota day is Friday's daily read. */
const AT = new Date("2026-11-28T04:30:00Z");
const DAY = "2026-11-27";
const UIDS = Array.from({ length: 12 }, (_, i) => i + 1);

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
  for (const day of ["2026-11-22", DAY])
    await db.insert(dailyReads).values({
      day,
      startedAt: new Date(`${day}T23:30:00-02:00`),
      status: "complete",
      callsUsed: 21,
      quotaRemainingBefore: 900,
    });
  await db.insert(dailyRosters).values({
    readDay: DAY,
    unionId: OWN_ALLIANCE_ID,
    memberCount: UIDS.length,
    isFresh: true,
    sourceUpdatedAt: new Date(`${DAY}T23:00:00-02:00`),
    memberUids: UIDS,
    memberNames: UIDS.map((u) => `Wren${u}`),
    memberPower: UIDS.map(() => 1),
    memberKills: UIDS.map(() => 0),
  });
});

function deps(now: Date) {
  const calls: number[] = [];
  const fetched: string[] = [];
  let remaining = 800;
  const d: SquadsDeps & { calls: number[]; fetched: string[]; at: Date } = {
    calls,
    fetched,
    at: now,
    now: () => d.at,
    env: { ...TEST_ENV, SAMPLE_EVERY_MIN: 15 },
    paceMs: 0,
    fetch: async (url) => {
      fetched.push(String(url));
      return Response.json({});
    },
    v1: {
      fetchPlayer: async (uid, onAttempt) => {
        onAttempt?.(0);
        calls.push(uid);
        const quota = { limit: 1000, used: 1000 - remaining, remaining: --remaining };
        const facts = {
          ...playerAnswer(uid).facts,
          shielding: 1,
          shieldType: 0,
          mapUpdatedAt: new Date("2026-11-28T03:35:00Z"),
        };
        // A squad in every answer: a read that wrote "Main squad might" would write a member fact.
        const squad = {
          squad: 1,
          power: 1000 + uid,
          soldiers: null,
          soldierLoad: null,
          seenAt: new Date("2026-11-28T03:35:00Z"),
          heroes: [],
          troops: [],
        };
        return playerAnswer(uid, [squad], quota, { facts });
      },
      fetchQuota: () => Promise.reject(new Error("no quota call on LAP_API_KEY")),
    },
  };
  return d;
}

const probe = (d: ReturnType<typeof deps>) => shieldProbe(d, db, d.at.getTime() + 180_000);
const probeLines = async () =>
  (await db.select().from(runLogs)).map((l) => [l.code, l.data] as const);

describe("the probe read of 2026-11-28 (issue 726)", () => {
  it("opens on 2026-11-28 02:30–02:45 ST only", async () => {
    // Before and after the window, Monday's old window, and the Saturday before.
    for (const at of [
      "2026-11-28T04:29:59Z",
      "2026-11-28T04:45:00Z",
      "2026-11-23T04:30:00Z",
      "2026-11-21T04:30:00Z",
    ]) {
      const outside = deps(new Date(at));
      await probe(outside);
      expect(outside.calls).toEqual([]);
    }
    const inside = deps(AT);
    await probe(inside);
    expect(inside.calls.toSorted((x, y) => x - y)).toEqual(UIDS);
  });

  it("runs at most once, with Monday's claim stored", async () => {
    // Monday 2026-11-23's run claimed id 3 at 02:30 ST.
    await db.insert(appAlerts).values({ id: 3, alertedAt: new Date("2026-11-23T04:30:00Z") });
    // Two ticks that overlap: one reads, the other finds the claim taken.
    const a = deps(AT);
    const b = deps(new Date(AT.getTime() + 1000));
    await Promise.all([probe(a), probe(b)]);
    expect([...a.calls, ...b.calls].toSorted((x, y) => x - y)).toEqual(UIDS);
    const later = deps(new Date("2026-11-28T04:40:00Z"));
    await probe(later);
    expect(later.calls).toEqual([]);
    expect(await db.select().from(playerReads)).toHaveLength(UIDS.length);
    expect(await probeLines()).toEqual([
      ["shield.probe", expect.objectContaining({ members: 12, calls: 12, players: 12, failed: 0 })],
    ]);
  });

  it("writes no mark, posts nothing, leaves the check's row, and no check window holds its readings", async () => {
    const start = serverInstant(PROBE_WINDOW.day, PROBE_WINDOW.from, TEST_ENV);
    // The latest a reading can land: the window's last tick plus the tick's whole `after` budget.
    const end =
      serverInstant(PROBE_WINDOW.day, PROBE_WINDOW.to, TEST_ENV).getTime() + AFTER_BUDGET_MS;
    const w = passWindows(fridayOf(PROBE_WINDOW.day), TEST_ENV);
    for (const pass of [w.night, w.morning])
      expect(end <= pass.from.getTime() || start >= pass.to).toBe(true);

    const check = {
      day: DAY,
      unionId: OWN_ALLIANCE_ID,
      nightAt: new Date("2026-11-28T01:30:00Z"),
    };
    await db.insert(shieldChecks).values(check);
    const before = await db.select().from(shieldChecks);
    const d = deps(start);
    await probe(d);
    expect(await db.select().from(playerReads)).toHaveLength(UIDS.length);
    expect(d.fetched).toEqual([]);
    expect(await db.select().from(shieldChecks)).toEqual(before);
    expect(await db.select().from(rollCallMarks)).toEqual([]);
    expect(await db.select().from(memberFacts)).toEqual([]);
    for (const pass of [w.night, w.morning])
      expect(await shieldReadings(db, OWN_ALLIANCE_ID, pass.from, pass.to)).toEqual([]);
  });

  it("makes no call when the read would cut into the morning check's calls", async () => {
    // Enough for the squads read's reserve, one short once the morning check's 120 calls are kept.
    const reserve = squadsReserve(AT, deps(AT).env, TRACKED_COUNT) + SHIELD_CALLS_MAX;
    await db.update(dailyReads).set({ quotaRemainingBefore: 21 + reserve + UIDS.length - 1 });
    const d = deps(AT);
    await probe(d);
    expect(d.calls).toEqual([]);
    expect(await probeLines()).toEqual([
      ["shield.probe", expect.objectContaining({ calls: 0, reason: "quota_low" })],
    ]);
  });

  it("makes no call while the day's squads read is still running", async () => {
    await db.insert(squadReads).values({
      day: DAY,
      unionId: OWN_ALLIANCE_ID,
      status: "running",
      startedAt: new Date("2026-11-28T01:31:00Z"),
      members: UIDS.length,
      quotaRemaining: 700,
    });
    const d = deps(AT);
    await probe(d);
    expect(d.calls).toEqual([]);
    expect(await probeLines()).toEqual([
      ["shield.probe", expect.objectContaining({ calls: 0, reason: "squads_busy" })],
    ]);
  });

  it("opens the tick's gate at 04:31Z with the squads queue settled, and the tick's batch runs the probe", async () => {
    await db.insert(squadReads).values({
      day: DAY,
      unionId: OWN_ALLIANCE_ID,
      status: "done",
      startedAt: new Date("2026-11-28T01:31:00Z"),
      members: UIDS.length,
      quotaRemaining: 700,
    });
    const { ctx, clock } = testContext(db);
    clock.now = new Date("2026-11-28T04:31:00Z");
    const stub = deps(clock.now);
    ctx.v1 = { ...ctx.v1, fetchPlayer: stub.v1.fetchPlayer };
    // Nothing else is due: the squads queue is settled, and no Raid Shield read runs at 02:31 ST.
    expect(await squadsMayRun(ctx, db)).toBe(false);
    expect(await tickMayBeDue(ctx, db)).toBe(true);
    // What /api/tick's `after` runs (scheduleSquadsBatch).
    await squadsBatch(ctx, undefined, "https://laptracker.test");
    expect(stub.calls.toSorted((x, y) => x - y)).toEqual(UIDS);
  });
});
