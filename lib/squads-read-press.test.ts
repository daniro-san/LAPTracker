// An /admin press on the squads read (D117, amendment 2026-11-19b) against PGlite with a stubbed
// /v1/players: outside the nightly window it goes on with the quota day's row, never in the event's
// window, and keeps the day's cap and the reserve.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { getSquadRead } from "./repo/squads";
import { saveWorkspace } from "./repo/workspaces";
import { dailyReads, dailyRosters } from "./schema";
import { squadReads } from "./schema-squads";
import { runSquadsBatch, type SquadsDeps } from "./squads-read";

const CFG = { ...TEST_ENV, SAMPLE_EVERY_MIN: 15 };
/** Thursday's read (UTC−2, 23:30): Friday 01:30 UTC, so it is Friday's quota day's. */
const THU = "2026-11-19";
/** Friday 13:00 server time: outside the nightly window. */
const PRESS = new Date("2026-11-20T15:00:00Z");
const force = { force: true };

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const ws = { unionId: OWN_ALLIANCE_ID, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] };
  await saveWorkspace(db, ws);
});

async function dayRead(day: string, uids: number[], quotaRemainingBefore: number) {
  const startedAt = new Date(`${day}T23:37:00-02:00`);
  await db
    .insert(dailyReads)
    .values({ day, startedAt, status: "complete", callsUsed: 21, quotaRemainingBefore });
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

/** A /v1/players stand-in with no squads, the quota counting down from `remaining`. */
function deps(now: Date, remaining = 800) {
  const calls: number[] = [];
  const d: SquadsDeps & { calls: number[] } = {
    calls,
    now: () => now,
    env: CFG,
    paceMs: 0,
    fetch: async () => Response.json({}),
    v1: {
      fetchPlayer: async (uid, onAttempt) => {
        onAttempt?.(0);
        calls.push(uid);
        const quota = { limit: 1000, used: 1000 - remaining, remaining: --remaining };
        return { uid, squads: [], quota };
      },
      fetchQuota: () => Promise.reject(new Error("no quota call on LAP_API_KEY")),
    },
  };
  return d;
}

describe("a press on /admin (D117, amendment 2026-11-19b)", () => {
  it("goes on from the night's cursor on the quota day's read, and never in the event's window", async () => {
    await dayRead(THU, [1, 2, 3], 900);
    const night = { day: THU, unionId: OWN_ALLIANCE_ID, startedAt: PRESS, members: 3 };
    await db.insert(squadReads).values({ ...night, status: "running", afterUid: 1, callsUsed: 1 });
    const d = deps(PRESS);
    expect(await runSquadsBatch(d, db)).toEqual({ kind: "idle" });
    expect(await runSquadsBatch(d, db, force)).toMatchObject({ status: "done", calls: 2 });
    expect(await runSquadsBatch(d, db, force)).toEqual({ kind: "idle" });
    expect(d.calls).toEqual([2, 3]);
    // Saturday 11:00 server time, inside the KvK's Before/After: nothing, whatever is due.
    await dayRead("2026-11-20", [1, 2, 3], 900);
    const kvk = deps(new Date("2026-11-21T13:00:00Z"));
    expect(await runSquadsBatch(kvk, db, force)).toEqual({ kind: "idle" });
    expect(kvk.calls).toEqual([]);
  });

  it("stops at the day's cap", async () => {
    await dayRead(
      THU,
      Array.from({ length: 130 }, (_, i) => i + 1),
      900,
    );
    expect(await runSquadsBatch(deps(PRESS), db, force)).toMatchObject({ calls: 120 });
    expect((await getSquadRead(db, THU, OWN_ALLIANCE_ID))?.reason).toBe("cap");
  });

  it("stops before a call would cut into the reserve", async () => {
    await dayRead(THU, [1, 2, 3], 230);
    expect(await runSquadsBatch(deps(PRESS, 101), db, force)).toMatchObject({ calls: 1 });
    expect((await getSquadRead(db, THU, OWN_ALLIANCE_ID))?.reason).toBe("quota");
  });
});
