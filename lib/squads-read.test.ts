// The nightly squads read (D117) against a real Postgres (PGlite) with a stubbed /v1/players and hero
// catalog: one call per member and never over the cap, the KvK quota day's skip, the reserve, squads kept
// when a response leaves them out, and "Main squad might" versions that respect an officer's value.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { factVersion, insertFact } from "./repo/member-facts";
import { getSquadRead, latestSquads } from "./repo/squads";
import { saveWorkspace } from "./repo/workspaces";
import { dailyReads, dailyRosters, runLogs } from "./schema";
import { memberSquads, squadReads } from "./schema-squads";
import {
  QuotaExhaustedError,
  UpstreamError,
  type PlayerSquadsInput,
  type SquadInput,
} from "./sources/types";
import { runSquadsBatch, type SquadsDeps } from "./squads-read";

const CFG = { ...TEST_ENV, SAMPLE_EVERY_MIN: 15 };
/** Thursday 23:39 server time (UTC−2): the day's read is done, the squads read is due. */
const THU = { now: new Date("2026-11-20T01:39:00Z"), day: "2026-11-19" };
/** Friday 23:39 server time: Saturday UTC, the KvK's quota day. */
const FRI = { now: new Date("2026-11-21T01:39:00Z"), day: "2026-11-20" };

let db: Db;
let ws: number;
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
  ws = (await db.query.workspaces.findFirst())?.id ?? 0;
});

async function dayRead(day: string, uids: number[], quotaRemainingBefore: number) {
  await db.insert(dailyReads).values({
    day,
    startedAt: new Date(`${day}T23:37:00-02:00`),
    status: "complete",
    callsUsed: 21,
    quotaRemainingBefore,
  });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: OWN_ALLIANCE_ID,
    memberCount: uids.length,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map(() => 1),
    memberKills: uids.map(() => 0),
  });
}

const sq = (squad: number, power: number, seenAt = "2026-11-19T20:00:00Z"): SquadInput => ({
  squad,
  power,
  soldiers: 4000,
  soldierLoad: 3800,
  seenAt: new Date(seenAt),
  heroes: [{ id: 10005, lv: 80, star: 22, q: 5, awaken: 0 }],
});

/** A /v1/players stand-in: `squads(uid)` per member, the quota counting down from `remaining`. */
function deps(now: Date, squads: (uid: number) => SquadInput[] = () => [], remaining = 800) {
  const calls: number[] = [];
  const catalog = { "10005": { icon: "/static/heroes/10005.png", name: "Kesso" } };
  const d: SquadsDeps & { calls: number[] } = {
    calls,
    now: () => now,
    env: CFG,
    paceMs: 0,
    fetch: async () => Response.json(catalog),
    v1: {
      fetchPlayer: async (uid, onAttempt): Promise<PlayerSquadsInput> => {
        onAttempt?.(0);
        calls.push(uid);
        const quota = { limit: 1000, used: 1000 - remaining, remaining: --remaining };
        return { uid, squads: squads(uid), quota };
      },
      // On LAP_API_KEY the run starts from the day's read: no /quota call (D117).
      fetchQuota: () => Promise.reject(new Error("no quota call on LAP_API_KEY")),
    },
  };
  return d;
}

describe("the squads read (D117)", () => {
  it("reads each member once, then is done; a big roster stops at the cap", async () => {
    await dayRead(THU.day, [3, 1, 2], 900);
    const d = deps(THU.now);
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "done", calls: 3, more: false });
    expect(await runSquadsBatch(d, db)).toEqual({ kind: "idle" });
    expect(d.calls).toEqual([1, 2, 3]);

    await truncateAll(db);
    // D125: the own alliance is read only while it has a workspace.
    await saveWorkspace(db, {
      unionId: OWN_ALLIANCE_ID,
      slug: "ogs",
      discordGuildId: "1",
      leaderRoleIds: ["2"],
    });
    await dayRead(
      THU.day,
      Array.from({ length: 130 }, (_, i) => i + 1),
      900,
    );
    const big = deps(THU.now);
    expect(await runSquadsBatch(big, db)).toMatchObject({ status: "stopped", calls: 120 });
    expect(await runSquadsBatch(big, db)).toEqual({ kind: "idle" });
    expect(big.calls).toHaveLength(120);
    expect((await getSquadRead(db, THU.day, OWN_ALLIANCE_ID))?.reason).toBe("cap");
  });

  it("skips Friday night when the KvK's reserve would be cut, says why, and logs no member", async () => {
    // The day's read started with 480 and made 21 calls: 459 left, under 3 + 100 + 365.
    await dayRead(FRI.day, [1, 2, 3], 480);
    const d = deps(FRI.now);
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "skipped", calls: 0 });
    expect(d.calls).toEqual([]);
    expect(await getSquadRead(db, FRI.day, OWN_ALLIANCE_ID)).toMatchObject({
      reason: "quota",
      quotaRemaining: 459,
    });
    const lines = await db.select().from(runLogs);
    expect(lines.map((l) => [l.code, l.unionId, l.data])).toEqual([
      ["squads.skip", null, { reason: "quota", quota_remaining: 459, required: 3 + 100 + 365 }],
    ]);
    // The same quota on a Thursday night leaves only the margin: the read runs.
    await dayRead(THU.day, [1, 2, 3], 480);
    expect(await runSquadsBatch(deps(THU.now), db)).toMatchObject({ status: "done", calls: 3 });
  });

  it("stops before a call would cut into the reserve", async () => {
    await dayRead(THU.day, [1, 2, 3], 230);
    // The first answer says 100 left: one more call would leave 99, under the margin of 100.
    const d = deps(THU.now, () => [], 101);
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "stopped", calls: 1 });
    expect(await getSquadRead(db, THU.day, OWN_ALLIANCE_ID)).toMatchObject({
      reason: "quota",
      quotaRemaining: 100,
    });
  });

  it("keeps a squad a later response leaves out, and stores an unchanged squad once", async () => {
    await dayRead(THU.day, [7], 900);
    await runSquadsBatch(
      deps(THU.now, () => [sq(1, 50_000_000), sq(2, 40_000_000)]),
      db,
    );
    await dayRead(FRI.day, [7], 900);
    const later = () => [sq(2, 45_000_000, "2026-11-20T20:00:00Z")];
    await runSquadsBatch(deps(FRI.now, later), db);
    // Saturday night: the same squad 2 again adds no row.
    await dayRead("2026-11-21", [7], 900);
    await runSquadsBatch(deps(new Date("2026-11-22T01:39:00Z"), later), db);
    const kept = await latestSquads(db, OWN_ALLIANCE_ID, 7);
    expect(kept.map((s) => [s.squad, s.power])).toEqual([
      [1, 50_000_000],
      [2, 45_000_000],
    ]);
    expect(await db.select().from(memberSquads)).toHaveLength(3);
  });

  it("stores a sighting later than our read as our read time", async () => {
    await dayRead(THU.day, [7], 900);
    // THU.now is 2026-11-20T01:39Z; the tracker claims a sighting a day later.
    await runSquadsBatch(
      deps(THU.now, () => [sq(1, 5_000_000, "2026-11-21T01:39:00Z")]),
      db,
    );
    const [stored] = await latestSquads(db, OWN_ALLIANCE_ID, 7);
    expect(stored?.seenAt).toEqual(THU.now);
  });

  it("writes the strongest squad as a tracker version, and leaves an officer's newer value", async () => {
    await insertFact(db, {
      workspaceId: ws,
      uid: 8,
      field: "squadMight",
      version: 1,
      value: 63_000_000,
      source: "officer",
      writtenBy: null,
      writtenAt: new Date("2026-11-19T21:00:00Z"),
    });
    await dayRead(THU.day, [7, 8], 900);
    await runSquadsBatch(
      deps(THU.now, () => [sq(1, 50_000_000), sq(2, 62_000_000)]),
      db,
    );
    expect(await factVersion(db, ws, 7, "squadMight", "newest")).toMatchObject({
      version: 1,
      value: 62_000_000,
      source: "tracker",
    });
    // Seen at 20:00, typed at 21:00: the officer's 63M stays the newest.
    expect(await factVersion(db, ws, 8, "squadMight", "newest")).toMatchObject({
      version: 1,
      source: "officer",
    });
  });
});

describe("the squads read's batches and claim (D117)", () => {
  /** A running day whose batch was claimed `ago` ms before THU.now, past uid 1. */
  async function runningDay(ago: number) {
    await dayRead(THU.day, [1, 2, 3], 900);
    await db.insert(squadReads).values({
      day: THU.day,
      unionId: OWN_ALLIANCE_ID,
      status: "running",
      startedAt: new Date(THU.now.getTime() - 300_000),
      batchAt: new Date(THU.now.getTime() - ago),
      members: 3,
      afterUid: 1,
      callsUsed: 1,
      quotaRemaining: 850,
    });
  }

  it("stops the day at a 429", async () => {
    await dayRead(THU.day, [1, 2, 3], 900);
    const d = deps(THU.now);
    const ok = d.v1.fetchPlayer;
    d.v1.fetchPlayer = async (uid, onAttempt, ...rest) => {
      if (uid === 2) {
        onAttempt?.(0);
        throw new QuotaExhaustedError("429 on /players/2");
      }
      return ok(uid, onAttempt, ...rest);
    };
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "stopped", calls: 2 });
    expect(await getSquadRead(db, THU.day, OWN_ALLIANCE_ID)).toMatchObject({
      reason: "quota_429",
      afterUid: 2,
    });
    expect(await runSquadsBatch(d, db)).toEqual({ kind: "idle" });
  });

  it("retries a 502 member once after the pass, and not a second time", async () => {
    await dayRead(THU.day, [1, 2, 3], 900);
    const d = deps(THU.now);
    const ok = d.v1.fetchPlayer;
    d.v1.fetchPlayer = async (uid, onAttempt, ...rest) => {
      if (uid !== 2) return ok(uid, onAttempt, ...rest);
      onAttempt?.(0);
      d.calls.push(uid);
      throw new UpstreamError(502);
    };
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "done", calls: 4 });
    expect(d.calls).toEqual([1, 2, 3, 2]);
    expect(await getSquadRead(db, THU.day, OWN_ALLIANCE_ID)).toMatchObject({
      failed: 2,
      retryUids: [],
    });
  });

  it("goes on from the cursor in the next batch, and gives a call the deadline cut its one retry", async () => {
    await dayRead(THU.day, [1, 2, 3], 900);
    // Member 2's first answer never comes: the deadline cuts the first batch after its call was sent.
    const first = { ...deps(THU.now), deadlineMs: 300 };
    const ok = first.v1.fetchPlayer;
    first.v1.fetchPlayer = async (uid, onAttempt, signal, options) => {
      if (uid !== 2) return ok(uid, onAttempt, signal, options);
      onAttempt?.(0);
      first.calls.push(uid);
      return new Promise((_, reject) =>
        signal?.addEventListener("abort", () => reject(signal.reason)),
      );
    };
    expect(await runSquadsBatch(first, db)).toMatchObject({ status: "running", more: true });
    expect(await getSquadRead(db, THU.day, OWN_ALLIANCE_ID)).toMatchObject({
      afterUid: 2,
      callsUsed: 2,
      failed: 1,
      retryUids: [2],
    });
    // The next batch reads 3, then retries 2 once; nobody else is called again.
    const second = deps(new Date(THU.now.getTime() + 2_000));
    expect(await runSquadsBatch(second, db)).toMatchObject({ status: "done", calls: 2 });
    expect([...first.calls, ...second.calls]).toEqual([1, 2, 3, 2]);
    expect(await getSquadRead(db, THU.day, OWN_ALLIANCE_ID)).toMatchObject({
      callsUsed: 4,
      retryUids: [],
    });
  });

  it("refuses a second caller while a batch holds the claim", async () => {
    await runningDay(10_000);
    const d = deps(THU.now);
    expect(await runSquadsBatch(d, db)).toEqual({ kind: "idle" });
    expect(d.calls).toEqual([]);
  });

  it("takes over a stale claim (a killed batch) and goes on after its cursor", async () => {
    await runningDay(200_000);
    const d = deps(THU.now);
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "done", calls: 2 });
    expect(d.calls).toEqual([2, 3]);
    expect(await getSquadRead(db, THU.day, OWN_ALLIANCE_ID)).toMatchObject({
      callsUsed: 3,
      batchAt: null,
    });
  });
});
