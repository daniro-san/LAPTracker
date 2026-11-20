// An /admin press on the squads read (D117, amendment 2026-11-19b; D132) against PGlite with a stubbed
// /v1/players: it reads the next members of the same queue the ticks read, never in the event's window,
// and keeps the day's cap.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { getSquadRead } from "./repo/squads";
import { saveWorkspace } from "./repo/workspaces";
import { dailyReads, dailyRosters } from "./schema";
import { squadQueue, squadReads } from "./schema-squads";
import { runSquadsBatch, type SquadsDeps } from "./squads-read";
import { playerAnswer } from "./squads.test-helpers";

const CFG = { ...TEST_ENV, SAMPLE_EVERY_MIN: 15 };
/** Thursday's read (UTC−2, 23:30): Friday 01:30 UTC, so it is Friday's quota day's. */
const THU = "2026-11-19";
/** Friday 13:00 server time. */
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
        return playerAnswer(uid, [], quota);
      },
      fetchQuota: () => Promise.reject(new Error("no quota call on LAP_API_KEY")),
    },
  };
  return d;
}

describe("a press on /admin (D117, amendment 2026-11-19b; D132)", () => {
  it("reads the members the ticks left in the quota day's queue, and never in the event's window", async () => {
    await dayRead(THU, [1, 2, 3], 900);
    const night = { day: THU, unionId: OWN_ALLIANCE_ID, startedAt: PRESS, members: 3 };
    await db.insert(squadReads).values({ ...night, status: "running", callsUsed: 1 });
    const q = { day: THU, unionId: OWN_ALLIANCE_ID, dueAt: PRESS };
    await db.insert(squadQueue).values([{ ...q, uid: 1, state: "done", attempts: 1 }]);
    const d = deps(PRESS);
    expect(await runSquadsBatch(d, db, force)).toMatchObject({ status: "done", calls: 2 });
    expect(await runSquadsBatch(d, db, force)).toEqual({ kind: "idle" });
    expect(d.calls).toEqual([2, 3]);
    // Saturday 11:00 server time, inside the KvK's Before/After: nothing, whatever is due.
    await dayRead("2026-11-20", [1, 2, 3], 900);
    const kvk = deps(new Date("2026-11-21T13:00:00Z"));
    expect(await runSquadsBatch(kvk, db, force)).toEqual({ kind: "idle" });
    expect(kvk.calls).toEqual([]);
  });

  it("keeps the day's cap, batches and retries included", async () => {
    await dayRead(
      THU,
      Array.from({ length: 130 }, (_, i) => i + 1),
      900,
    );
    const d = deps(PRESS);
    for (let i = 0; i < 6; i++) await runSquadsBatch(d, db, force);
    expect(d.calls).toHaveLength(120);
    expect((await getSquadRead(db, THU, OWN_ALLIANCE_ID))?.reason).toBe("cap");
  });
});
