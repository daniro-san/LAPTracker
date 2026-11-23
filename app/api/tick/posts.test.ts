// The tick sends the catalog's post 1 (#713 part C, D159): an officer turned "This week in the alliance" on,
// and the next Monday tick that opens the database posts the week to the members' channel, after its answer.
// A Monday tick with nothing due answers 204 before any query and schedules no post: the post wakes the
// database no extra time (D141). This is the end-to-end step the e2e suite cannot drive (its server runs on
// the real clock). Post 2, the shield-up reminder, goes at Friday's 20:30 ST tick, which the Friday check
// opens anyway. Invented names only.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { request, TEST_CRON_SECRET, TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { findWorkspaceBySlug, saveWorkspace } from "@/lib/repo/workspaces";
import { calendarEntries } from "@/lib/schema";
import { workspacePosts } from "@/lib/schema-discord";

const holder = vi.hoisted(() => ({
  ctx: null as AppContext | null,
  later: [] as (() => unknown)[],
}));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
// The work after the answer, kept to run once the answer is out, as Next does.
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (work: () => unknown) => void holder.later.push(work),
}));

const { POST } = await import("./route");

const HOOK = "https://discord.com/api/webhooks/9100/ash-members";
const ENV = {
  ...TEST_ENV,
  WORKSPACE_DISCORD_WEBHOOKS: { ash: { members: { url: HOOK, name: "members", forum: false } } },
};

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.later = [];
  await saveWorkspace(db, {
    unionId: 67109951,
    slug: "ash",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
    memberRoleIds: ["3"],
  });
  const ws = (await findWorkspaceBySlug(db, "ash"))?.id ?? 0;
  await db.insert(workspacePosts).values({
    workspaceId: ws,
    postKey: "week",
    on: true,
    channel: "members",
    updatedAt: new Date("2026-11-27T12:00:00Z"),
  });
  await db.insert(calendarEntries).values({
    workspaceId: ws,
    kind: "undead",
    level: 6,
    day: "2026-12-02",
    minute: 1200,
    forMembers: true,
  });
});

/** The tick at `now`, then its work after the answer; its status and what Discord got. */
async function tick(now: Date) {
  const { ctx, clock, posts } = testContext(db, ENV);
  holder.ctx = ctx;
  clock.now = now;
  const res = await POST(
    request("/api/tick", { headers: { authorization: `Bearer ${TEST_CRON_SECRET}` } }),
  );
  await Promise.allSettled(holder.later.splice(0).map((work) => work()));
  return { status: res.status, posts: posts.filter((p) => p.url === HOOK) };
}

describe("the tick's catalog posts (D159)", () => {
  it("posts the week once at Monday's first tick that opens the database, and never wakes it for that", async () => {
    // Mon 00:30 ST: nothing else is due, so the tick asks the database nothing and schedules no post.
    const idle = await tick(new Date("2026-11-30T02:30:00Z"));
    expect(idle).toEqual({ status: 204, posts: [] });

    // Mon 01:00 ST: the heartbeat opens the database; the week goes out after the answer.
    const heartbeat = await tick(new Date("2026-11-30T03:00:00Z"));
    expect(heartbeat.posts).toHaveLength(1);
    expect(heartbeat.posts[0]?.content).toBe(
      "**This week in the alliance**\n\nWednesday, December 2\n20:00 ST · Undead Siege · Lv.6",
    );
    expect(heartbeat.posts[0]?.body.allowed_mentions).toEqual({ parse: [] });

    // The next heartbeat of the same Monday finds the week posted.
    expect((await tick(new Date("2026-11-30T06:00:00Z"))).posts).toEqual([]);
  });

  it("posts the shield-up reminder at Friday's 20:30 ST tick, which the Friday check opens anyway", async () => {
    const ws = (await findWorkspaceBySlug(db, "ash"))?.id ?? 0;
    await db.insert(workspacePosts).values({
      workspaceId: ws,
      postKey: "shield_up",
      on: true,
      channel: "members",
      updatedAt: new Date("2026-11-27T12:00:00Z"),
    });
    // Fri 20:15 ST: the Friday check (QUOTA_CHECK_AT 20:00, 45 min) opens the database; too early to post.
    expect((await tick(new Date("2026-11-27T22:15:00Z"))).posts).toEqual([]);
    // Fri 20:30 ST: the same window's tick; the reminder goes out after the answer.
    const due = await tick(new Date("2026-11-27T22:30:00Z"));
    expect(due.posts).toHaveLength(1);
    expect(due.posts[0]?.content).toMatch(/^\*\*Shield up before the reset\*\*\n\nRaid tonight/);
    // Fri 20:45 ST: the window has closed, nothing else is due, so no wake and no post.
    expect(await tick(new Date("2026-11-27T22:45:00Z"))).toEqual({ status: 204, posts: [] });
  });
});
