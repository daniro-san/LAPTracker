// Members who join during the day (D132): an answer whose alliance roster the tracker updated after the
// day's roster read queues them, and the queue is sent only the uids it does not have yet (issue 507).
// PGlite with a stubbed /v1/players; invented uids.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { saveWorkspace } from "./repo/workspaces";
import { dailyReads, dailyRosters } from "./schema";
import type { PlayerSquadsInput } from "./sources/types";
import { runSquadsBatch, type SquadsDeps } from "./squads-read";
import { playerAnswer } from "./squads.test-helpers";

/** Thursday 23:39 server time (UTC−2): the day's read (23:37 ST) is done, the squads queue starts. */
const NOW = new Date("2026-11-20T01:39:00Z");
const DAY = "2026-11-19";
/** The tracker updated the alliance after the day's roster read. */
const NEWER = new Date("2026-11-20T01:38:00Z");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const ws = { unionId: OWN_ALLIANCE_ID, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] };
  await saveWorkspace(db, ws);
});

async function dayRead(uids: number[]) {
  const startedAt = new Date(`${DAY}T23:37:00-02:00`);
  await db
    .insert(dailyReads)
    .values({ day: DAY, startedAt, status: "complete", callsUsed: 21, quotaRemainingBefore: 900 });
  await db.insert(dailyRosters).values({
    readDay: DAY,
    unionId: OWN_ALLIANCE_ID,
    memberCount: uids.length,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `P${u}`),
    memberPower: uids.map(() => 1),
    memberKills: uids.map(() => 0),
  });
}

/** A /v1/players stand-in: each answer carries the alliance roster `rosterOf(uid)` gives. */
function deps(rosterOf: (uid: number) => PlayerSquadsInput["roster"]) {
  const calls: number[] = [];
  let remaining = 800;
  const d: SquadsDeps & { calls: number[] } = {
    calls,
    now: () => NOW,
    env: { ...TEST_ENV, SAMPLE_EVERY_MIN: 15 },
    paceMs: 0,
    fetch: async () => Response.json({}),
    v1: {
      fetchPlayer: async (uid, onAttempt) => {
        onAttempt?.(0);
        calls.push(uid);
        const quota = { limit: 1000, used: 1000 - remaining, remaining: --remaining };
        return playerAnswer(uid, [], quota, { roster: rosterOf(uid) });
      },
      fetchQuota: () => Promise.reject(new Error("no quota call on LAP_API_KEY")),
    },
  };
  return d;
}

/** The rows of each insert into the squads queue that reaches Postgres while `run` goes. */
async function queueInserts(run: () => Promise<void>): Promise<number[]> {
  const client = (db as unknown as { $client: { query: (q: string, ...r: unknown[]) => unknown } })
    .$client;
  const query = client.query;
  const sent: number[] = [];
  client.query = (q, ...rest) => {
    if (q.startsWith('insert into "squad_queue"')) sent.push(q.split("), (").length);
    return query.call(client, q, ...rest);
  };
  try {
    await run();
  } finally {
    client.query = query;
  }
  return sent;
}

describe("members who join during the day (D132)", () => {
  it("queues a member who joined after the day's roster, from an answer's newer alliance roster", async () => {
    await dayRead([1, 2]);
    // Member 1's answer carries a roster older than the day's read, with 8, who has left since: 8 is not
    // added. Member 2's carries a newer one, where 9 has joined.
    const d = deps((uid) =>
      uid === 1
        ? { unionId: OWN_ALLIANCE_ID, updatedAt: new Date("2026-11-19T20:00:00Z"), uids: [1, 2, 8] }
        : { unionId: OWN_ALLIANCE_ID, updatedAt: NEWER, uids: [1, 2, 9] },
    );
    expect(await runSquadsBatch(d, db)).toMatchObject({ calls: 2, more: true });
    expect(await runSquadsBatch(d, db)).toMatchObject({ status: "done", calls: 1 });
    expect(d.calls).toEqual([1, 2, 9]);
  });

  it("sends the queue a batch's roster and each newcomer once, not the roster after every answer (issue 507)", async () => {
    await dayRead([1, 2, 3]);
    const d = deps(() => ({ unionId: OWN_ALLIANCE_ID, updatedAt: NEWER, uids: [1, 2, 3, 9] }));
    const sent = await queueInserts(async () => {
      expect(await runSquadsBatch(d, db)).toMatchObject({ calls: 3, more: true });
      expect(await runSquadsBatch(d, db)).toMatchObject({ status: "done", calls: 1 });
    });
    expect(d.calls).toEqual([1, 2, 3, 9]);
    // Each batch: the day's roster (3 rows), then the newcomer (1); answers that add nobody send nothing.
    expect(sent).toEqual([3, 1, 3, 1]);
  });
});
