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
import { memberSquads } from "./schema-squads";
import type { PlayerSquadsInput, SquadInput } from "./sources/types";
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
    await dayRead(
      THU.day,
      Array.from({ length: 130 }, (_, i) => i + 1),
      900,
    );
    const big = deps(THU.now);
    expect(await runSquadsBatch(big, db)).toMatchObject({ status: "stopped", calls: 120 });
    expect(await runSquadsBatch(big, db)).toEqual({ kind: "idle" });
    expect(big.calls).toHaveLength(120);
    expect((await getSquadRead(db, THU.day))?.reason).toBe("cap");
  });

  it("skips Friday night when the KvK's reserve would be cut, says why, and logs no member", async () => {
    // The day's read started with 480 and made 21 calls: 459 left, under 3 + 100 + 365.
    await dayRead(FRI.day, [1, 2, 3], 480);
    const d = deps(FRI.now);
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "skipped", calls: 0 });
    expect(d.calls).toEqual([]);
    expect(await getSquadRead(db, FRI.day)).toMatchObject({ reason: "quota", quotaRemaining: 459 });
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
    expect(await getSquadRead(db, THU.day)).toMatchObject({ reason: "quota", quotaRemaining: 100 });
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
