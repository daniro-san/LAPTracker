// The after-reset check (issue 827) against PGlite with a stubbed /v1/players: it reads each shield-check
// alliance on Saturdays 02:30–03:00 ST only, each member at most once a week even when two ticks overlap;
// the 02:45 tick goes on where 02:30's budget ended, and a second alliance reads on its own saved key; it
// skips an alliance whose switch is off, keeps the morning check's calls and gives way to a running squads
// read; its readings fall in no event window and in neither pass window, and it writes no mark, post or
// check row.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID, TRACKED_COUNT } from "../config/alliances";
import { TEST_ENV, testContext } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { shieldReadings } from "./repo/shield-checks";
import { setAllianceSwitch, setSwitch } from "./repo/workspace-features";
import { storeKey } from "./repo/workspace-keys";
import { findWorkspaceBySlug, saveWorkspace } from "./repo/workspaces";
import { inEventWindow, serverInstant } from "./schedule";
import { dailyReads, dailyRosters, runLogs } from "./schema";
import { memberFacts } from "./schema-facts";
import { rollCallMarks } from "./schema-rollcall";
import { shieldChecks, shieldSettings } from "./schema-shield";
import { playerReads, squadReads } from "./schema-squads";
import { passWindows, resetWindow, SHIELD_CALLS_MAX } from "./shield-check";
import { shieldReset } from "./shield-reset";
import { squadsReserve } from "./squads";
import type { SquadsDeps } from "./squads-read";
import { AFTER_BUDGET_MS, squadsBatch } from "./squads-tick";
import { playerAnswer } from "./squads.test-helpers";
import { squadsMayRun, tickMayBeDue } from "./tick-gate";
import { sealKey } from "./workspace-keys";

/** Sat 2026-11-28 02:30 ST (UTC−2): the read's tick. Its quota day is Friday's daily read. */
const AT = new Date("2026-11-28T04:30:00Z");
const DAY = "2026-11-27";
/** The next Saturday's tick, and its Friday. */
const NEXT = new Date("2026-12-05T04:30:00Z");
const NEXT_DAY = "2026-12-04";
const UIDS = Array.from({ length: 12 }, (_, i) => i + 1);
/** Invented, low-entropy values: never real keys. */
const SECRET = Buffer.alloc(32, 7).toString("base64");
const THEIR_KEY = `lap_${"their-alliance-test-".repeat(2)}key`;
const OTHER = 67109944;
const OTHER_UIDS = [21, 22, 23];

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
  for (const day of [DAY, NEXT_DAY]) {
    await db.insert(dailyReads).values({
      day,
      startedAt: new Date(`${day}T23:30:00-02:00`),
      status: "complete",
      callsUsed: 21,
      quotaRemainingBefore: 900,
    });
    await db.insert(dailyRosters).values({
      readDay: day,
      unionId: OWN_ALLIANCE_ID,
      memberCount: UIDS.length,
      isFresh: true,
      sourceUpdatedAt: new Date(`${day}T23:00:00-02:00`),
      memberUids: UIDS,
      memberNames: UIDS.map((u) => `Wren${u}`),
      memberPower: UIDS.map(() => 1),
      memberKills: UIDS.map(() => 0),
    });
  }
});

/** A /v1 stand-in; `keys` records each call's key (undefined: LAP_API_KEY); each call moves the clock by `stepMs`. */
function deps(now: Date, stepMs = 0) {
  const calls: number[] = [];
  const keys: { uid: number | "quota"; key: string | undefined }[] = [];
  const fetched: string[] = [];
  let remaining = 800;
  const d: SquadsDeps & { calls: number[]; keys: typeof keys; fetched: string[]; at: Date } = {
    calls,
    keys,
    fetched,
    at: now,
    now: () => d.at,
    env: { ...TEST_ENV, SAMPLE_EVERY_MIN: 15, WORKSPACE_KEYS_SECRET: SECRET },
    paceMs: 0,
    fetch: async (url) => {
      fetched.push(String(url));
      return Response.json({});
    },
    v1: {
      fetchPlayer: async (uid, onAttempt, _signal, options) => {
        onAttempt?.(0);
        calls.push(uid);
        keys.push({ uid, key: options?.apiKey });
        d.at = new Date(d.at.getTime() + stepMs);
        const quota = { limit: 1000, used: 1000 - remaining, remaining: --remaining };
        const facts = {
          ...playerAnswer(uid).facts,
          shielding: 1,
          shieldType: 0,
          mapUpdatedAt: new Date(d.at.getTime() - 55 * 60_000),
        };
        // A squad in every answer: a read that wrote "Main squad might" would write a member fact.
        const squad = {
          squad: 1,
          power: 1000 + uid,
          soldiers: null,
          soldierLoad: null,
          seenAt: d.at,
          heroes: [],
          troops: [],
        };
        return playerAnswer(uid, [squad], quota, { facts });
      },
      fetchQuota: async (onAttempt, _signal, options) => {
        if (!options?.apiKey) throw new Error("no quota call on LAP_API_KEY");
        onAttempt?.(0);
        keys.push({ uid: "quota", key: options.apiKey });
        return { limit: 1000, used: 100, remaining: 900 };
      },
    },
  };
  return d;
}

const read = (d: ReturnType<typeof deps>) => shieldReset(d, db, d.at.getTime() + 180_000);
const lines = async () => (await db.select().from(runLogs)).map((l) => [l.code, l.data] as const);
const sorted = (uids: number[]) => uids.toSorted((x, y) => x - y);

describe("the after-reset check (issue 827)", () => {
  it("runs on Saturdays 02:30–03:00 ST only, each member once a week even when two ticks overlap", async () => {
    // Before and after the window, and the same hour on Friday and Sunday.
    for (const at of [
      "2026-11-28T04:29:59Z",
      "2026-11-28T05:00:00Z",
      "2026-11-27T04:30:00Z",
      "2026-11-29T04:30:00Z",
    ]) {
      const outside = deps(new Date(at));
      await read(outside);
      expect(outside.calls).toEqual([]);
    }
    const a = deps(AT);
    const b = deps(new Date(AT.getTime() + 1000));
    await Promise.all([read(a), read(b)]);
    expect(sorted([...a.calls, ...b.calls])).toEqual(UIDS);
    // The 02:45 tick finds everyone read: no call, no line.
    const later = deps(new Date("2026-11-28T04:45:00Z"));
    await read(later);
    expect(later.calls).toEqual([]);
    // The next Saturday reads again.
    const next = deps(NEXT);
    await read(next);
    expect(sorted(next.calls)).toEqual(UIDS);
    expect(await lines()).toEqual([
      ["shield.reset", expect.objectContaining({ members: 12, calls: 12, players: 12, failed: 0 })],
      ["shield.reset", expect.objectContaining({ members: 12, calls: 12, players: 12, failed: 0 })],
    ]);
  });

  it("stays outside every event window and both pass windows, and writes no mark, post or check row", async () => {
    for (let week = 0; week < 4; week++) {
      const saturday = new Date(AT.getTime() + week * 7 * 86_400_000).toISOString().slice(0, 10);
      const start = serverInstant(saturday, "02:30", TEST_ENV).getTime();
      // The latest a reading can land: the window's last tick plus the tick's whole `after` budget.
      const end = serverInstant(saturday, "03:00", TEST_ENV).getTime() + AFTER_BUDGET_MS;
      for (let t = start; t <= end; t += 60_000)
        expect(inEventWindow(new Date(t), TEST_ENV)).toBe(false);
      const friday = new Date(start - 86_400_000).toISOString().slice(0, 10);
      const w = passWindows(friday, TEST_ENV);
      for (const pass of [w.night, w.morning])
        expect(end <= pass.from.getTime() || start >= pass.to.getTime()).toBe(true);
      const r = resetWindow(friday, TEST_ENV);
      expect(start >= r.from.getTime() && end < r.to.getTime()).toBe(true);
    }

    const check = { day: DAY, unionId: OWN_ALLIANCE_ID, nightAt: new Date("2026-11-28T01:30:00Z") };
    await db.insert(shieldChecks).values(check);
    const before = await db.select().from(shieldChecks);
    const d = deps(AT);
    await read(d);
    expect(d.fetched).toEqual([]);
    expect(await db.select().from(shieldChecks)).toEqual(before);
    expect(await db.select().from(rollCallMarks)).toEqual([]);
    expect(await db.select().from(memberFacts)).toEqual([]);
    const w = passWindows(DAY, TEST_ENV);
    for (const pass of [w.night, w.morning])
      expect(await shieldReadings(db, OWN_ALLIANCE_ID, pass.from, pass.to)).toEqual([]);
    const r = resetWindow(DAY, TEST_ENV);
    expect(await shieldReadings(db, OWN_ALLIANCE_ID, r.from, r.to)).toHaveLength(UIDS.length);
  });

  it("reads a second alliance on its own saved key, on the 02:45 tick when 02:30's budget ran out", async () => {
    await saveWorkspace(db, {
      unionId: OTHER,
      slug: "other",
      discordGuildId: "3",
      leaderRoleIds: ["4"],
    });
    const other = (await findWorkspaceBySlug(db, "other"))?.id ?? 0;
    await setSwitch(db, other, "shield_check", true, new Date(0));
    await setAllianceSwitch(db, other, "shield_check", true, new Date(0));
    const sealed = sealKey(SECRET, other, THEIR_KEY);
    await storeKey(db, other, sealed, { status: "ok", quotaRemaining: 900 }, new Date(0));
    await db.insert(dailyRosters).values({
      readDay: DAY,
      unionId: OTHER,
      memberCount: OTHER_UIDS.length,
      isFresh: true,
      sourceUpdatedAt: new Date(`${DAY}T23:00:00-02:00`),
      memberUids: OTHER_UIDS,
      memberNames: OTHER_UIDS.map((u) => `Fern${u}`),
      memberPower: OTHER_UIDS.map(() => 1),
      memberKills: OTHER_UIDS.map(() => 0),
    });
    // 02:30: 20 s a call, so the 180 s budget ends after 9 of OGs' 12; the other alliance waits.
    const first = deps(AT, 20_000);
    await read(first);
    expect(first.keys).toEqual(UIDS.slice(0, 9).map((uid) => ({ uid, key: undefined })));
    // 02:45: OGs' 3 left, then the other alliance on its own key only (its /quota call too).
    const second = deps(new Date("2026-11-28T04:45:00Z"));
    await read(second);
    expect(second.keys).toEqual([
      ...UIDS.slice(9).map((uid) => ({ uid, key: undefined })),
      { uid: "quota", key: THEIR_KEY },
      ...OTHER_UIDS.map((uid) => ({ uid, key: THEIR_KEY })),
    ]);
    // Each member read once.
    const reads = await db.select().from(playerReads);
    expect(sorted(reads.map((r) => r.uid))).toEqual([...UIDS, ...OTHER_UIDS]);
    expect(await lines()).toEqual([
      [
        "shield.reset",
        expect.objectContaining({ union_id: OWN_ALLIANCE_ID, calls: 9, reason: "deadline" }),
      ],
      [
        "shield.reset",
        expect.objectContaining({ union_id: OWN_ALLIANCE_ID, members: 3, calls: 3 }),
      ],
      [
        "shield.reset",
        expect.objectContaining({ union_id: OTHER, members: 3, calls: 4, players: 3 }),
      ],
    ]);
  });

  it("reads no alliance whose officers turned the after-reset check off (issue 859)", async () => {
    const ws = await findWorkspaceBySlug(db, "ogs");
    await db
      .insert(shieldSettings)
      .values({ workspaceId: ws?.id ?? 0, resetRead: false, updatedAt: AT });
    const d = deps(AT);
    await read(d);
    expect(d.calls).toEqual([]);
    expect(await lines()).toEqual([]);
  });

  it("reads no alliance whose Raid Shield check is off", async () => {
    const ws = await findWorkspaceBySlug(db, "ogs");
    await setSwitch(db, ws?.id ?? 0, "shield_check", false, AT);
    const d = deps(AT);
    await read(d);
    expect(d.calls).toEqual([]);
    expect(await lines()).toEqual([]);
  });

  it("makes no call when the read would cut into the morning check's calls", async () => {
    // Enough for the squads read's reserve, one short once the morning check's 120 calls are kept.
    const reserve = squadsReserve(AT, deps(AT).env, TRACKED_COUNT) + SHIELD_CALLS_MAX;
    await db.update(dailyReads).set({ quotaRemainingBefore: 21 + reserve + UIDS.length - 1 });
    const d = deps(AT);
    await read(d);
    expect(d.calls).toEqual([]);
    expect(await lines()).toEqual([
      ["shield.reset", expect.objectContaining({ calls: 0, reason: "quota_low" })],
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
    await read(d);
    expect(d.calls).toEqual([]);
    expect(await lines()).toEqual([
      ["shield.reset", expect.objectContaining({ calls: 0, reason: "squads_busy" })],
    ]);
  });

  it("opens the tick's gate at 04:31Z with the squads queue settled, and the tick's batch runs the read", async () => {
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
    // Nothing else is due: the squads queue is settled, and no other Raid Shield read runs at 02:31 ST.
    expect(await squadsMayRun(ctx, db)).toBe(false);
    expect(await tickMayBeDue(ctx, db)).toBe(true);
    // What /api/tick's `after` runs (scheduleSquadsBatch).
    await squadsBatch(ctx, undefined, "https://laptracker.test");
    expect(sorted(stub.calls)).toEqual(UIDS);
  });
});
