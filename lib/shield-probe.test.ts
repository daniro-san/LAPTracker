// Issue 726's one-off probe read against PGlite with a stubbed /v1/players: it reads the own alliance once,
// only inside 02:30–02:45 ST on 2026-11-23, at most once even when two ticks overlap; it writes no mark,
// posts nothing, leaves the Raid Shield check's row as it was, and its readings fall in neither check's
// window. Removed with lib/shield-probe.ts by the follow-up PR.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { shieldReadings } from "./repo/shield-checks";
import { saveWorkspace } from "./repo/workspaces";
import { dailyReads, dailyRosters, runLogs } from "./schema";
import { memberFacts } from "./schema-facts";
import { rollCallMarks } from "./schema-rollcall";
import { shieldChecks } from "./schema-shield";
import { playerReads } from "./schema-squads";
import { passWindows } from "./shield-check";
import { shieldProbe } from "./shield-probe";
import type { SquadsDeps } from "./squads-read";
import { playerAnswer } from "./squads.test-helpers";

/** Mon 2026-11-23 02:30 ST (UTC−2): the probe's tick. Its quota day is Sunday's daily read. */
const AT = new Date("2026-11-23T04:30:00Z");
const DAY = "2026-11-22";
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
  for (const day of ["2026-11-20", DAY])
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
          mapUpdatedAt: new Date("2026-11-23T02:31:00Z"),
        };
        return playerAnswer(uid, [], quota, { facts });
      },
      fetchQuota: () => Promise.reject(new Error("no quota call on LAP_API_KEY")),
    },
  };
  return d;
}

const probe = (d: ReturnType<typeof deps>) => shieldProbe(d, db, d.at.getTime() + 180_000);

describe("the probe read of 2026-11-23 (issue 726)", () => {
  it("reads every member once, only inside its window, and at most once", async () => {
    for (const at of ["2026-11-23T04:29:59Z", "2026-11-23T04:45:00Z", "2026-11-22T04:30:00Z"]) {
      const outside = deps(new Date(at));
      await probe(outside);
      expect(outside.calls).toEqual([]);
    }
    // Two ticks that overlap: one reads, the other finds the claim taken.
    const a = deps(AT);
    const b = deps(new Date(AT.getTime() + 1000));
    await Promise.all([probe(a), probe(b)]);
    expect([...a.calls, ...b.calls].toSorted((x, y) => x - y)).toEqual(UIDS);
    const later = deps(new Date("2026-11-23T04:40:00Z"));
    await probe(later);
    expect(later.calls).toEqual([]);
    expect(await db.select().from(playerReads)).toHaveLength(UIDS.length);
    const lines = await db.select().from(runLogs);
    expect(lines.map((l) => [l.code, l.data])).toEqual([
      ["shield.probe", expect.objectContaining({ members: 12, calls: 12, players: 12, failed: 0 })],
    ]);
  });

  it("writes no mark, posts nothing, leaves the check's row, and no check window holds its readings", async () => {
    const check = {
      day: "2026-11-20",
      unionId: OWN_ALLIANCE_ID,
      nightAt: new Date("2026-11-21T01:30:00Z"),
      morningStatus: "done" as const,
      morningCalls: 100,
    };
    await db.insert(shieldChecks).values(check);
    const before = await db.select().from(shieldChecks);
    const d = deps(AT);
    await probe(d);
    expect(d.calls).toHaveLength(UIDS.length);
    expect(d.fetched).toEqual([]);
    expect(await db.select().from(shieldChecks)).toEqual(before);
    expect(await db.select().from(rollCallMarks)).toEqual([]);
    expect(await db.select().from(memberFacts)).toEqual([]);
    for (const friday of ["2026-11-20", "2026-11-27"]) {
      const w = passWindows(friday, TEST_ENV);
      for (const pass of [w.night, w.morning])
        expect(await shieldReadings(db, OWN_ALLIANCE_ID, pass.from, pass.to)).toEqual([]);
    }
  });
});
