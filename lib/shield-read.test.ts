// The Raid Shield check's two reads (D137) against a real Postgres (PGlite) with a stubbed /v1/players and
// a stubbed Discord webhook: Friday's burst is that day's squads read and ends with everyone read once;
// Saturday's morning read reads everyone once more, from the alliance's own time, never past its cap; nothing
// runs at any other time; the summary is posted once to the Raid Shield channel and then edited, only when
// turned on (D147).
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { OWN_ALLIANCE_ID, TRACKED_COUNT } from "../config/alliances";
import { TEST_ENV } from "./app-context.test-helpers";
import type { Db } from "./db";
import { openTestDb, truncateAll } from "./db.test-helpers";
import { saveWorkspace } from "./repo/workspaces";
import { dailyReads, dailyRosters } from "./schema";
import { shieldChecks, shieldQueue, shieldSettings } from "./schema-shield";
import { playerReads, squadQueue, squadReads } from "./schema-squads";
import { postShieldSummary, type PostDeps } from "./shield-post";
import { HOOK_SECRET, saveHook } from "./shield-post.test-helpers";
import type { ShieldTarget } from "./shield-read";
import { shieldTick } from "./shield-tick";
import { squadsReserve } from "./squads";
import type { SquadsDeps } from "./squads-read";
import { playerAnswer } from "./squads.test-helpers";
import { squadTargets } from "./workspace-keys";

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
  await saveHook(db, ws, { channel: "shield", url: HOOK });
});

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

async function dayRead(uids: number[], name = (u: number) => `Wren${u}`) {
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
    memberNames: uids.map(name),
    memberPower: uids.map(() => 1),
    memberKills: uids.map(() => 0),
  });
}

/**
 * Every member answers; odd uids are seen with an 8-hour shield. `step`: how far the clock moves per call;
 * `remaining`: the quota before the first call; `gone`: Discord answers an edit with 404; `forum`: the
 * channel is a forum, where Discord answers a post without `thread_name` with 400.
 */
function deps(
  now: Date,
  opts: { step?: number; remaining?: number; gone?: boolean; forum?: boolean } = {},
) {
  const calls: number[] = [];
  const posts: { method: string; url: string; content: string; threadName?: string | undefined }[] =
    [];
  let remaining = opts.remaining ?? 900;
  const d: SquadsDeps & {
    calls: number[];
    posts: typeof posts;
    at: Date;
    origin: string;
  } = {
    calls,
    posts,
    at: now,
    origin: "https://laptracker.test",
    now: () => d.at,
    // The workspace's saved Raid Shield channel (beforeEach) opens with this key (D147).
    env: { ...TEST_ENV, SAMPLE_EVERY_MIN: 15, WORKSPACE_KEYS_SECRET: HOOK_SECRET },
    paceMs: 0,
    fetch: async (url, init) => {
      const href = String(url);
      if (!href.startsWith(HOOK)) return Response.json({});
      const body = JSON.parse(String(init?.body)) as { content: string; thread_name?: string };
      const method = String(init?.method);
      posts.push({ method, url: href, content: body.content, threadName: body.thread_name });
      if (opts.forum && method === "POST" && !body.thread_name)
        return new Response(null, { status: 400 });
      if (opts.gone && init?.method === "PATCH") return new Response(null, { status: 404 });
      return Response.json({ id: "900" });
    },
    v1: {
      fetchPlayer: async (uid, onAttempt) => {
        onAttempt?.(0);
        calls.push(uid);
        d.at = new Date(d.at.getTime() + (opts.step ?? 0));
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
    expect(d.posts[0]?.content).toContain("23:39 ST: shield seen on 2 of 4 maps so far");
    expect(d.posts[0]?.content).not.toContain("Wren");
    d.at = SAT;
    await tick(d);
    expect(d.posts[1]?.method).toBe("PATCH");
    expect(d.posts[1]?.url).toBe(`${HOOK}/messages/900`);
    expect(d.posts[1]?.content).toContain("Not seen this morning: Wren2, Wren4");
  });

  it("opens a titled post in a forum Raid Shield channel and edits it inside that post", async () => {
    await dayRead(range(4));
    await db.insert(shieldSettings).values({ workspaceId: ws, discord: true, updatedAt: FRI });
    await saveHook(db, ws, { channel: "shield", url: HOOK, forum: true });
    const d = deps(FRI, { forum: true });
    await tick(d);
    expect(d.posts[0]).toMatchObject({ method: "POST", threadName: "Raid Shield check" });
    d.at = SAT;
    await tick(d);
    expect(d.posts[1]).toMatchObject({
      method: "PATCH",
      url: `${HOOK}/messages/900?thread_id=900`,
      threadName: undefined,
    });
    const [check] = await db.select().from(shieldChecks);
    expect(check?.messageId).toBe("900");
  });

  it("starts no batch that could end after 00:00 ST on Friday", async () => {
    await dayRead(range(30));
    const d = deps(new Date("2026-11-21T01:59:30Z")); // 23:59:30 ST
    await tick(d);
    expect(d.calls).toEqual([]);
    d.at = new Date("2026-11-21T01:58:30Z"); // 23:58:30 ST: one batch still ends by 00:00
    await tick(d);
    expect(d.calls.length).toBeGreaterThan(0);
  });

  it("makes no call at or after 12:00 ST on Saturday", async () => {
    await dayRead(range(30));
    // 11:59:00 ST, each call takes 20 s: calls at 11:59:00, :20 and :40, none at 12:00.
    const d = deps(new Date("2026-11-21T13:59:00Z"), { step: 20_000 });
    await tick(d);
    expect(d.calls).toHaveLength(3);
    const [check] = await db.select().from(shieldChecks);
    expect(check).toMatchObject({ morningStatus: "running", morningReason: null });
  });

  it("stops before the reserve and waits, on our key", async () => {
    await dayRead(range(30));
    const reserve = squadsReserve(SAT, { ...TEST_ENV, SAMPLE_EVERY_MIN: 15 }, TRACKED_COUNT);
    const startedAt = new Date("2026-11-21T01:31:00Z");
    await db.insert(squadReads).values({
      day: DAY,
      unionId: OWN_ALLIANCE_ID,
      status: "done",
      startedAt,
      members: 30,
      quotaRemaining: reserve + 3,
    });
    const d = deps(SAT, { remaining: reserve + 3 });
    await tick(d);
    expect(d.calls).toHaveLength(3);
    const [check] = await db.select().from(shieldChecks);
    expect(check).toMatchObject({ morningStatus: "running", morningQuotaRemaining: reserve });
  });

  it("shows typed names literally in the leaders' message", async () => {
    await dayRead(range(2), (u) => (u === 2 ? "[click](https://evil.test) @everyone" : `Wren${u}`));
    await db.insert(shieldSettings).values({ workspaceId: ws, discord: true, updatedAt: FRI });
    const d = deps(FRI);
    await tick(d);
    d.at = SAT;
    await tick(d);
    const content = d.posts[1]?.content ?? "";
    expect(content).toContain("\\[click\\](https://evil.test) @\u200beveryone");
    expect(content).not.toContain("[click](");
  });

  it("keeps Friday's summary until a morning reading exists, and edits only a changed text", async () => {
    await dayRead(range(4));
    await db.insert(shieldSettings).values({ workspaceId: ws, discord: true, updatedAt: FRI });
    const d = deps(FRI);
    await tick(d);
    expect(d.posts).toHaveLength(1);
    const [target] = await shieldTargetsOf(d);
    if (!target) throw new Error("no target");
    const post = { env: d.env, fetch: d.fetch, now: d.now, origin: d.origin } as PostDeps;
    // Saturday before any morning answer: the same text as Friday's, so no edit.
    d.at = new Date("2026-11-21T11:00:00Z");
    expect(await postShieldSummary(post, db, { day: DAY, target, pass: "morning" })).toBe(true);
    expect(d.posts).toHaveLength(1);
    d.at = SAT;
    await tick(d);
    expect(d.posts).toHaveLength(2);
    expect(d.posts[1]?.content).toContain("Not seen this morning: Wren2, Wren4");
  });

  it("never posts again a message Discord says was deleted", async () => {
    await dayRead(range(4));
    await db.insert(shieldSettings).values({ workspaceId: ws, discord: true, updatedAt: FRI });
    const d = deps(FRI, { gone: true });
    await tick(d);
    d.at = SAT;
    await tick(d);
    expect(d.posts.map((p) => p.method)).toEqual(["POST", "PATCH"]);
    const [check] = await db.select().from(shieldChecks);
    expect(check?.messageHash).toBe("gone");
    d.at = new Date(SAT.getTime() + 15 * 60_000);
    await tick(d);
    expect(d.posts).toHaveLength(2);
  });
});

/** The shield targets as the tick sees them, for a direct call of the leaders' message. */
async function shieldTargetsOf(d: ReturnType<typeof deps>): Promise<ShieldTarget[]> {
  const [settings] = await db.select().from(shieldSettings);
  const targets = await squadTargets(db, d.env.WORKSPACE_KEYS_SECRET, d.at, "shield_check");
  return targets.map((t) => ({ ...t, settings: settings ?? null }));
}
