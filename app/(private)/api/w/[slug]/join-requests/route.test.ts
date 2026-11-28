// POST /api/w/[slug]/join-requests (issue 868): Approve links the Discord user to the player as an approved
// "This is me", gives the member role with the bot token and posts the welcome when that post is on; Decline
// posts nothing; a request older than 7 days is gone; another workspace's request is never seen or answered.
// Discord is a stub: no real call is made. Invented ids and tokens only.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { joinRequestsView } from "@/lib/private/join-requests";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { dailyReads, dailyRosters, workspaces, workspaceUsers } from "@/lib/schema";
import { joinRequests, postRuns, workspaceDiscord, workspacePosts } from "@/lib/schema-discord";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const ORIGIN = "https://laptracker.test";
const GUILD = "900000000000000101";
const ROLE = "900000000000000606";
const BOT_ROLE = "900000000000000607";
const JOINER = "700000000000000002";
const MEMBERS_HOOK = "https://discord.com/api/webhooks/900000000000000404/members-hook-test-token";
const ENV = {
  ...TEST_ENV,
  DISCORD_CLIENT_ID: "900000000000000505",
  DISCORD_BOT_TOKEN: "bot-token-for-tests-only",
  DISCORD_API_BASE_URL: "https://discord.test/api",
  WORKSPACE_DISCORD_WEBHOOKS: {
    alpha: { members: { url: MEMBERS_HOOK, name: "town-square", forum: false } },
  },
};
const UID = 990_001;

let db: Db;
const sessions: Record<string, string> = {};
const ids: Record<string, number> = {};
let calls: { method: string; url: string; auth: string; body: string }[] = [];

function stubDiscord(): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      method: init?.method ?? "GET",
      url: String(input),
      auth: headers.get("authorization") ?? "",
      body: typeof init?.body === "string" ? init.body : "",
    });
    if (init?.method === "PUT") return new Response(null, { status: 204 });
    // The give's re-check: the member role sits below the bot's own, with no powerful permission.
    if (String(input).endsWith(`/guilds/${GUILD}/roles`))
      return Response.json([
        { id: ROLE, name: "Member", position: 1, permissions: "1024" },
        { id: BOT_ROLE, name: "LAPTracker", position: 5, permissions: "268435456", managed: true },
      ]);
    if (String(input).endsWith(`/members/${ENV.DISCORD_CLIENT_ID}`))
      return Response.json({ roles: [BOT_ROLE] });
    return Response.json({ id: "1" });
  };
}

async function seedWorkspace(slug: string, unionId: number, guild: string) {
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId, slug, discordGuildId: guild, leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  const id = ws?.id ?? 0;
  ids[slug] = id;
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: id, discordUserId: `officer-${slug}`, displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  sessions[slug] = (await createSession(db, id, user?.id ?? 0, T0, null, "officer")).token;
  await db.insert(dailyRosters).values({
    readDay: "2026-11-06",
    unionId,
    memberCount: 2,
    isFresh: true,
    memberUids: [UID, UID + 1],
    memberNames: ["Moss Invented", "Wren Invented"],
    memberPower: [1000, 1000],
    memberKills: [0, 0],
  });
}

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const ctx = testContext(db, ENV).ctx;
  ctx.fetch = stubDiscord();
  holder.ctx = ctx;
  calls = [];
  await db.insert(dailyReads).values({ day: "2026-11-06", startedAt: T0, status: "complete" });
  await seedWorkspace("alpha", 67109944, GUILD);
  await seedWorkspace("bravo", 67109945, "900000000000000202");
  await db.insert(joinRequests).values({
    workspaceId: ids.alpha ?? 0,
    discordUserId: JOINER,
    discordName: "mossy",
    typed: "Moss Invented",
    createdAt: new Date(T0.getTime() - 60_000),
  });
});

const requestId = async () => (await db.select().from(joinRequests))[0]?.id ?? 0;

const post = (slug: string, body: unknown) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/${slug}/join-requests`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${sessions[slug]}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug }) },
  );

const accessOf = async (slug: string) => {
  const a = await requireWorkspace(db, slug, { get: () => ({ value: sessions[slug] ?? "" }) }, T0);
  if (!a.ok) throw new Error("no access");
  return a;
};

describe("POST /api/w/[slug]/join-requests (issue 868)", () => {
  it("Approve: an approved link, the member role from the bot, and the welcome when it is on", async () => {
    const alpha = ids.alpha ?? 0;
    await db
      .insert(workspaceDiscord)
      .values({ workspaceId: alpha, memberRoleId: ROLE, memberRoleName: "Member" });
    await db.insert(workspacePosts).values({
      workspaceId: alpha,
      postKey: "welcome",
      on: true,
      channel: "members",
      updatedAt: T0,
    });
    const [view] = await joinRequestsView(db, await accessOf("alpha"), T0);
    expect(view?.candidates.map((c) => c.uid)).toEqual([UID]);

    const res = await post("alpha", { action: "approve", id: await requestId(), uid: UID });
    expect(await res.json()).toEqual({ ok: true, role: "given", welcome: "posted" });
    const [linked] = await db
      .select()
      .from(workspaceUsers)
      .where(eq(workspaceUsers.discordUserId, JOINER));
    expect(linked).toMatchObject({
      workspaceId: alpha,
      playerUid: UID,
      playerLink: "approved",
      welcomedAt: T0,
    });
    expect(await db.select().from(joinRequests)).toEqual([]);
    const put = calls.find((c) => c.method === "PUT");
    expect(put).toMatchObject({
      url: `https://discord.test/api/guilds/${GUILD}/members/${JOINER}/roles/${ROLE}`,
      auth: `Bot ${ENV.DISCORD_BOT_TOKEN}`,
    });
    const welcome = calls.find((c) => c.url.startsWith(MEMBERS_HOOK));
    expect(welcome?.body).toContain("Moss Invented");
  });

  it("two officers approving at once: one goes on, the other finds it gone, and one role is given", async () => {
    await db
      .insert(workspaceDiscord)
      .values({ workspaceId: ids.alpha ?? 0, memberRoleId: ROLE, memberRoleName: "Member" });
    const id = await requestId();
    const answers = await Promise.all(
      [0, 1].map(async () => (await post("alpha", { action: "approve", id, uid: UID })).status),
    );
    expect(answers.sort()).toEqual([200, 404]);
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(1);
  });

  it("no second welcome for a player the daily welcome already named; the mark is still set", async () => {
    const alpha = ids.alpha ?? 0;
    await db.insert(workspacePosts).values({
      workspaceId: alpha,
      postKey: "welcome",
      on: true,
      channel: "members",
      updatedAt: T0,
    });
    // The welcome of the roster's day went out, so it named the newcomers in it.
    await db.insert(postRuns).values({
      workspaceId: alpha,
      postKey: "welcome",
      period: "2026-11-06",
      status: "posted",
      at: T0,
    });
    const res = await post("alpha", { action: "approve", id: await requestId(), uid: UID });
    expect(await res.json()).toEqual({ ok: true, role: "none", welcome: "off" });
    expect(calls.filter((c) => c.url.startsWith(MEMBERS_HOOK))).toEqual([]);
    const [linked] = await db
      .select()
      .from(workspaceUsers)
      .where(eq(workspaceUsers.discordUserId, JOINER));
    expect(linked?.welcomedAt).toEqual(T0);
  });

  it("Decline: the request goes and nothing is posted or linked", async () => {
    const res = await post("alpha", { action: "decline", id: await requestId() });
    expect(await res.json()).toEqual({ ok: true, declined: true });
    expect(calls).toEqual([]);
    expect(await db.select().from(joinRequests)).toEqual([]);
    expect((await db.select().from(workspaceUsers)).map((u) => u.discordUserId)).not.toContain(
      JOINER,
    );
  });

  it("a request older than 7 days is no longer shown or answered", async () => {
    await db.update(joinRequests).set({ createdAt: new Date(T0.getTime() - 7 * 86_400_000) });
    expect(await joinRequestsView(db, await accessOf("alpha"), T0)).toEqual([]);
    const res = await post("alpha", { action: "approve", id: await requestId(), uid: UID });
    expect([res.status, await res.json()]).toEqual([404, { code: "gone" }]);
  });

  it("another workspace's officer never sees or answers the request", async () => {
    expect(await joinRequestsView(db, await accessOf("bravo"), T0)).toEqual([]);
    const id = await requestId();
    const approve = await post("bravo", { action: "approve", id, uid: UID });
    const decline = await post("bravo", { action: "decline", id });
    expect([approve.status, decline.status]).toEqual([404, 404]);
    expect(await db.select().from(joinRequests)).toHaveLength(1);
    expect(calls).toEqual([]);
  });
});
