// The Raid Shield check's two reads (D137) against a real Postgres (PGlite) with a stubbed /v1/players and
// a stubbed Discord webhook: Friday's burst is that day's squads read and ends with everyone read once;
// Saturday's morning read reads everyone once more, from the alliance's own time, never past its cap; nothing
// runs at any other time; the leaders' message is posted once and then edited, only when turned on.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID } from "../config/alliances";
import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { saveWorkspace } from "./repo/workspaces";
import { dailyReads, dailyRosters } from "./schema";
import { shieldChecks, shieldQueue, shieldSettings } from "./schema-shield";
import { playerReads, squadQueue } from "./schema-squads";
import { shieldTick } from "./shield-tick";
import type { SquadsDeps } from "./squads-read";
import { playerAnswer } from "./squads.test-helpers";

/** Friday 23:39 ST (UTC−2): the day's read is done, the burst starts. */
const FRI = new Date("2026-11-21T01:39:00Z");
const DAY = "2026-11-20";
/** Saturday 10:05 ST. */
const SAT = new Date("2026-11-21T12:05:00Z");
const HOOK = "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz";

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

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

async function dayRead(uids: number[]) {
  await db.insert(dailyReads).values({
    day: DAY,
    startedAt: new Date(`${DAY}T23:30:00-02:00`),
    status: "complete",
    callsUsed: 21,
    quotaRemainingBefore: 900,
  });
  await db.insert(dailyRosters).values({
    readDay: DAY,
    unionId: OWN_ALLIANCE_ID,
    memberCount: uids.length,
    isFresh: true,
    sourceUpdatedAt: new Date(`${DAY}T23:00:00-02:00`),
    memberUids: uids,
    memberNames: uids.map((u) => `Wren${u}`),
    memberPower: uids.map(() => 1),
    memberKills: uids.map(() => 0),
  });
}

/** Every member answers; odd uids are seen with an 8-hour shield. */
function deps(now: Date) {
  const calls: number[] = [];
  const posts: { method: string; url: string; content: string }[] = [];
  let remaining = 900;
  const d: SquadsDeps & {
    calls: number[];
    posts: typeof posts;
    at: Date;
    origin: string;
    env: SquadsDeps["env"] & { WORKSPACE_DISCORD_WEBHOOKS?: Record<string, unknown> };
  } = {
    calls,
    posts,
    at: now,
    origin: "https://laptracker.test",
    now: () => d.at,
    env: {
      ...TEST_ENV,
      SAMPLE_EVERY_MIN: 15,
      WORKSPACE_DISCORD_WEBHOOKS: {
        ogs: { leaders: { url: HOOK, name: "leaders", forum: false } },
      },
    },
    paceMs: 0,
    fetch: async (url, init) => {
      const href = String(url);
      if (!href.startsWith(HOOK)) return Response.json({});
      const body = JSON.parse(String(init?.body)) as { content: string };
      posts.push({ method: String(init?.method), url: href, content: body.content });
      return Response.json({ id: "900" });
    },
    v1: {
      fetchPlayer: async (uid, onAttempt) => {
        onAttempt?.(0);
        calls.push(uid);
        const quota = { limit: 1000, used: 1000 - remaining, remaining: --remaining };
        const facts = {
          ...playerAnswer(uid).facts,
          shielding: uid % 2,
          shieldType: 0,
          mapUpdatedAt: new Date("2026-11-21T00:32:00Z"),
        };
        return playerAnswer(uid, [], quota, { facts });
      },
      fetchQuota: () => Promise.reject(new Error("no quota call on LAP_API_KEY")),
    },
  };
  return d;
}

const tick = (d: ReturnType<typeof deps>) =>
  shieldTick(d as Parameters<typeof shieldTick>[0], db, d.at.getTime() + 180_000);

describe("the Raid Shield check's reads (D137)", () => {
  it("reads the whole alliance on Friday night as that day's squads read, each member once", async () => {
    await dayRead(range(60));
    const d = deps(FRI);
    await tick(d);
    expect(d.calls.toSorted((a, b) => a - b)).toEqual(range(60));
    const queue = await db.select().from(squadQueue);
    expect(queue.every((q) => q.state === "done")).toBe(true);
    // A second tick that night reads nobody again.
    d.at = new Date(FRI.getTime() + 15 * 60_000);
    await tick(d);
    expect(d.calls).toHaveLength(60);
    expect(await db.select().from(playerReads)).toHaveLength(60);
  });

  it("reads everyone once more on Saturday from the alliance's own time, and nothing at other times", async () => {
    await dayRead(range(30));
    await db.insert(shieldSettings).values({ workspaceId: ws, morningMinute: 630, updatedAt: SAT });
    const d = deps(new Date("2026-11-20T01:39:00Z")); // Thursday 23:39 ST
    await tick(d);
    d.at = SAT; // 10:05 ST, before 10:30
    await tick(d);
    expect(d.calls).toEqual([]);
    d.at = new Date("2026-11-21T12:35:00Z"); // 10:35 ST
    await tick(d);
    expect(d.calls.toSorted((a, b) => a - b)).toEqual(range(30));
    const [check] = await db.select().from(shieldChecks);
    expect(check).toMatchObject({ morningStatus: "done", morningCalls: 30 });
    d.at = new Date("2026-11-21T14:05:00Z"); // 12:05 ST: KvK has started
    await db.delete(shieldQueue);
    await db.update(shieldChecks).set({ morningStatus: null });
    await tick(d);
    expect(d.calls).toHaveLength(30);
  });

  it("never makes more than 120 calls in the morning read", async () => {
    await dayRead(range(130));
    const d = deps(SAT);
    await tick(d);
    expect(d.calls).toHaveLength(120);
    const [check] = await db.select().from(shieldChecks);
    expect(check).toMatchObject({ morningStatus: "stopped", morningReason: "cap" });
  });

  it("posts one leaders' message on Friday and edits it on Saturday, only when turned on", async () => {
    await dayRead(range(4));
    const d = deps(FRI);
    await tick(d);
    expect(d.posts).toEqual([]);
    await db.insert(shieldSettings).values({ workspaceId: ws, discord: true, updatedAt: FRI });
    d.at = new Date(FRI.getTime() + 15 * 60_000);
    await tick(d);
    expect(d.posts).toHaveLength(1);
    expect(d.posts[0]?.method).toBe("POST");
    expect(d.posts[0]?.content).toContain("23:39 ST: 2 of 4 shielded");
    expect(d.posts[0]?.content).toContain("Not seen yet: Wren2, Wren4");
    d.at = SAT;
    await tick(d);
    expect(d.posts[1]?.method).toBe("PATCH");
    expect(d.posts[1]?.url).toBe(`${HOOK}/messages/900`);
    expect(d.posts[1]?.content).toContain("Not seen this morning: Wren2, Wren4");
  });
});
