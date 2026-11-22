// The squads read (D117) as a daily queue (D132) against a real Postgres (PGlite) with a stubbed
// /v1/players and hero catalog: small batches, one answer per member and never over the cap, the KvK
// reserve that waits instead of skipping, retries at the back of the queue, members who join during the
// day, squads kept when a response leaves them out, and "Main squad might" versions that respect an
// officer's value.
import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { factVersion, insertFact } from "./repo/member-facts";
import { getSquadRead, latestSquads } from "./repo/squads";
import { saveWorkspace } from "./repo/workspaces";
import { dailyReads, dailyRosters, runLogs } from "./schema";
import { memberSquads, playerReads, squadQueue, squadReads } from "./schema-squads";
import {
  QuotaExhaustedError,
  UpstreamError,
  type PlayerSquadsInput,
  type SquadInput,
} from "./sources/types";
import { SQUADS_RETRY_AFTER_MS } from "./squads";
import { runSquadsBatch, type SquadsDeps } from "./squads-read";
import { playerAnswer } from "./squads.test-helpers";

const CFG = { ...TEST_ENV, SAMPLE_EVERY_MIN: 15 };
/** Thursday 23:39 server time (UTC−2): the day's read is done, the squads queue starts. */
const THU = { now: new Date("2026-11-20T01:39:00Z"), day: "2026-11-19" };
/** Friday 23:39 server time: Saturday UTC, the KvK's quota day. */
const FRI = { now: new Date("2026-11-21T01:39:00Z"), day: "2026-11-20" };
const later = (at: Date, ms: number) => new Date(at.getTime() + ms);

let db: Db;
let ws: number;
const ogs = { unionId: OWN_ALLIANCE_ID, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] };
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, ogs);
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

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

const sq = (squad: number, power: number, seenAt = "2026-11-19T20:00:00Z"): SquadInput => ({
  squad,
  power,
  soldiers: 4000,
  soldierLoad: 3800,
  seenAt: new Date(seenAt),
  heroes: [{ id: 10005, lv: 80, star: 22, q: 5, awaken: 0, honor: 4 }],
  troops: [{ id: 1009, tier: 9, n: 2150 }],
});

type Answer = (uid: number) => Partial<PlayerSquadsInput> | Error;

/** A /v1/players stand-in: `answer(uid)` per member, the quota counting down from `remaining`. */
function deps(now: Date, answer: Answer = () => ({}), remaining = 800) {
  const calls: number[] = [];
  const catalog = { "10005": { icon: "/static/heroes/10005.png", name: "Kesso" } };
  const d: SquadsDeps & { calls: number[]; at: Date } = {
    calls,
    at: now,
    now: () => d.at,
    env: CFG,
    paceMs: 0,
    fetch: async () => Response.json(catalog),
    v1: {
      fetchPlayer: async (uid, onAttempt) => {
        onAttempt?.(0);
        calls.push(uid);
        const got = answer(uid);
        if (got instanceof Error) throw got;
        const quota = { limit: 1000, used: 1000 - remaining, remaining: --remaining };
        return playerAnswer(uid, [], quota, got);
      },
      // On LAP_API_KEY the run starts from the day's read: no /quota call (D117).
      fetchQuota: () => Promise.reject(new Error("no quota call on LAP_API_KEY")),
    },
  };
  return d;
}

const queueOf = (day: string) =>
  db
    .select({ uid: squadQueue.uid, state: squadQueue.state, attempts: squadQueue.attempts })
    .from(squadQueue)
    .where(and(eq(squadQueue.day, day), eq(squadQueue.unionId, OWN_ALLIANCE_ID)))
    .orderBy(squadQueue.uid);

describe("the squads queue (D117, D132)", () => {
  it("reads every member once in small batches, then is done; a big roster stops at the cap", async () => {
    await dayRead(THU.day, range(30), 900);
    const d = deps(THU.now);
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "running", calls: 25, more: true });
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "done", calls: 5, more: false });
    expect(await runSquadsBatch(d, db)).toEqual({ kind: "idle" });
    expect([...d.calls].sort((a, b) => a - b)).toEqual(range(30));
    expect((await queueOf(THU.day)).every((m) => m.state === "done" && m.attempts === 1)).toBe(
      true,
    );
    // D132: each answer is kept as a player read, from the same call.
    expect(await db.select().from(playerReads)).toHaveLength(30);

    await truncateAll(db);
    await saveWorkspace(db, ogs);
    await dayRead(THU.day, range(130), 900);
    const big = deps(THU.now);
    for (let i = 0; i < 6; i++) await runSquadsBatch(big, db);
    expect(big.calls).toHaveLength(120);
    expect(await getSquadRead(db, THU.day, OWN_ALLIANCE_ID)).toMatchObject({
      status: "stopped",
      reason: "cap",
    });
  });

  it("waits for the KvK's reserve on Friday night, never reads in the event's window, and goes on after", async () => {
    // The day's read started with 480 and made 21 calls: 459 left, under 1 + 100 + 365.
    await dayRead(FRI.day, [1, 2, 3], 480);
    const d = deps(FRI.now);
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "running", calls: 0, more: false });
    expect(await getSquadRead(db, FRI.day, OWN_ALLIANCE_ID)).toMatchObject({
      reason: "quota",
      quotaRemaining: 459,
    });
    // Saturday 11:00 server time, inside the KvK's Before/After: the own key reads nothing.
    d.at = new Date("2026-11-21T13:00:00Z");
    expect(await runSquadsBatch(d, db)).toEqual({ kind: "idle" });
    // Saturday 20:00 server time, same quota day: the event is over, its reserve is free again.
    d.at = new Date("2026-11-21T22:00:00Z");
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "done", calls: 3 });
    expect(d.calls).toEqual([1, 2, 3]);
    const lines = await db.select().from(runLogs);
    // A batch that only waited logs nothing; no line names a member.
    expect(lines.filter((l) => l.code === "squads.batch")).toHaveLength(1);
    expect(JSON.stringify(lines)).not.toContain("P1");
  });

  it("waits before a call would cut into the reserve", async () => {
    await dayRead(THU.day, [1, 2, 3], 230);
    // The first answer says 100 left: one more call would leave 99, under the margin of 100.
    const d = deps(THU.now, () => ({}), 101);
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "running", calls: 1 });
    expect(await getSquadRead(db, THU.day, OWN_ALLIANCE_ID)).toMatchObject({
      reason: "quota",
      quotaRemaining: 100,
    });
  });

  it("keeps a squad a later response leaves out, and stores an unchanged squad once", async () => {
    await dayRead(THU.day, [7], 900);
    await runSquadsBatch(
      deps(THU.now, () => ({ squads: [sq(1, 50e6), sq(2, 40e6)] })),
      db,
    );
    await dayRead(FRI.day, [7], 900);
    const two = () => ({ squads: [sq(2, 45e6, "2026-11-20T20:00:00Z")] });
    await runSquadsBatch(deps(FRI.now, two), db);
    // Saturday night: the same squad 2 again adds no row.
    await dayRead("2026-11-21", [7], 900);
    await runSquadsBatch(deps(new Date("2026-11-22T01:39:00Z"), two), db);
    const kept = await latestSquads(db, OWN_ALLIANCE_ID, 7);
    expect(kept.map((s) => [s.squad, s.power])).toEqual([
      [1, 50e6],
      [2, 45e6],
    ]);
    const rows = await db.select().from(memberSquads);
    expect(rows).toHaveLength(3);
    // D132: the troops and each hero's Hall of Honor level are kept.
    expect(rows[0]).toMatchObject({
      troops: [{ id: 1009, tier: 9, n: 2150 }],
      heroes: [{ id: 10005, honor: 4 }],
    });
  });

  it("stores a sighting later than our read as our read time", async () => {
    await dayRead(THU.day, [7], 900);
    // THU.now is 2026-11-20T01:39Z; the tracker claims a sighting a day later.
    await runSquadsBatch(
      deps(THU.now, () => ({ squads: [sq(1, 5e6, "2026-11-21T01:39:00Z")] })),
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
      deps(THU.now, () => ({ squads: [sq(1, 50e6), sq(2, 62e6)] })),
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

describe("the queue's retries, newcomers and claim (D132)", () => {
  it("stops the day at a 429", async () => {
    await dayRead(THU.day, [1, 2, 3], 900);
    const d = deps(THU.now, (uid) => (uid === 2 ? new QuotaExhaustedError("429") : {}));
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "stopped", calls: 2 });
    expect((await getSquadRead(db, THU.day, OWN_ALLIANCE_ID))?.reason).toBe("quota_429");
    d.at = later(THU.now, SQUADS_RETRY_AFTER_MS);
    expect(await runSquadsBatch(d, db)).toEqual({ kind: "idle" });
    expect(d.calls).toEqual([1, 2]);
  });

  it("stops the day at a 401 or a 403 on our own key, not member by member up to the cap", async () => {
    for (const [day, status] of [[THU.day, 401] as const, [FRI.day, 403] as const]) {
      await dayRead(day, range(30), 2000);
      const d = deps(day === THU.day ? THU.now : FRI.now, () => new UpstreamError(status));
      expect(await runSquadsBatch(d, db)).toMatchObject({ status: "stopped", calls: 1 });
      const why = (await getSquadRead(db, day, OWN_ALLIANCE_ID))?.reason;
      expect(why).toBe(status === 401 ? "key_invalid" : "key_forbidden");
    }
  });

  it("sends a 502 member to the back of the queue, tries again on a later tick, 3 times at most", async () => {
    await dayRead(THU.day, [1, 2, 3], 900);
    const d = deps(THU.now, (uid) => (uid === 2 ? new UpstreamError(502) : {}));
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "running", calls: 3, more: false });
    // The same tick's turn has not come again: no call.
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "running", calls: 0 });
    d.at = later(THU.now, SQUADS_RETRY_AFTER_MS);
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "running", calls: 1 });
    d.at = later(THU.now, 2 * SQUADS_RETRY_AFTER_MS);
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "done", calls: 1 });
    expect(d.calls).toEqual([1, 2, 3, 2, 2]);
    expect((await queueOf(THU.day)).find((m) => m.uid === 2)).toEqual({
      uid: 2,
      state: "failed",
      attempts: 3,
    });
    expect(await getSquadRead(db, THU.day, OWN_ALLIANCE_ID)).toMatchObject({ failed: 3 });
  });

  it("queues a member who joined after the day's roster, from an answer's newer alliance roster", async () => {
    await dayRead(THU.day, [1, 2], 900);
    const roster = (updatedAt: string, uids: number[]) => ({
      roster: { unionId: OWN_ALLIANCE_ID, updatedAt: new Date(updatedAt), uids },
    });
    // Member 1's answer carries a roster older than the day's read, with 8, who has left since: 8 is not
    // added. Member 2's carries a newer one, where 9 has joined.
    const d = deps(THU.now, (uid) =>
      uid === 1
        ? roster("2026-11-19T20:00:00Z", [1, 2, 8])
        : roster("2026-11-20T01:38:00Z", [1, 2, 9]),
    );
    expect(await runSquadsBatch(d, db)).toMatchObject({ calls: 2, more: true });
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "done", calls: 1 });
    expect(d.calls).toEqual([1, 2, 9]);
  });

  it("refuses a second caller while a batch holds the claim, and takes over a stale one", async () => {
    await dayRead(THU.day, [1, 2, 3], 900);
    const dueAt = later(THU.now, -300_000);
    const run = { status: "running" as const, startedAt: dueAt, members: 3, callsUsed: 1 };
    const batchAt = later(THU.now, -10_000);
    await db.insert(squadReads).values({ day: THU.day, unionId: OWN_ALLIANCE_ID, ...run, batchAt });
    await db.insert(squadQueue).values([
      { day: THU.day, unionId: OWN_ALLIANCE_ID, uid: 1, state: "done", attempts: 1, dueAt },
      { day: THU.day, unionId: OWN_ALLIANCE_ID, uid: 2, dueAt },
      { day: THU.day, unionId: OWN_ALLIANCE_ID, uid: 3, dueAt },
    ]);
    const d = deps(THU.now);
    expect(await runSquadsBatch(d, db)).toEqual({ kind: "idle" });
    // A claim older than 150 s belongs to a killed function.
    await db.update(squadReads).set({ batchAt: later(THU.now, -200_000) });
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "done", calls: 2 });
    expect(d.calls).toEqual([2, 3]);
    expect(await getSquadRead(db, THU.day, OWN_ALLIANCE_ID)).toMatchObject({
      callsUsed: 3,
      batchAt: null,
    });
  });

  it("gives a call the deadline cut an attempt, and the next batch goes on", async () => {
    await dayRead(THU.day, [1, 2, 3], 900);
    // Member 2's first answer never comes: the deadline cuts the batch after its call was sent.
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
    expect(await runSquadsBatch(first, db)).toMatchObject({ status: "running", calls: 2 });
    const second = deps(later(THU.now, 2_000));
    expect(await runSquadsBatch(second, db)).toMatchObject({ status: "running", calls: 1 });
    expect([...first.calls, ...second.calls]).toEqual([1, 2, 3]);
    expect((await queueOf(THU.day)).find((m) => m.uid === 2)).toMatchObject({
      state: "waiting",
      attempts: 1,
    });
  });
});
