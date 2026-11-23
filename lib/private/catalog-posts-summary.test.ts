// The catalog's post 4, "Weekly members summary" (D159 amendment 2026-11-23, issue 713 part F), against a real
// Postgres (PGlite): on Monday from 00:00 ST it tells the leaders' channel how many members joined and left in
// the week that just ended, and the member count at its last daily update and at the one before the week.
// It goes once however many ticks overlap, only while the owner allows it and the alliance has it on, and
// posts nothing when there is no roster to compare. Counts only: no name, no private field, no coin, quest
// or donation value and no ping reach Discord. Invented names only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { testContext, TEST_ENV } from "../app-context.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { setSwitch } from "../repo/workspace-features";
import { findWorkspaceBySlug, saveWorkspace } from "../repo/workspaces";
import { dailyRosters } from "../schema";
import { postRuns, workspacePosts } from "../schema-discord";
import { PRIVATE_MARKERS } from "../workspace-data.test-helpers";
import type { WorkspaceAccess } from "./access";
import { sendDuePosts } from "./catalog-posts";
import { postsView } from "./post-settings";

const HOOK = "https://discord.com/api/webhooks/9000/nse-leaders";
const ENV = {
  ...TEST_ENV,
  WORKSPACE_DISCORD_WEBHOOKS: { nse: { leaders: { url: HOOK, name: "officers", forum: false } } },
};

let db: Db;
let ws = 0;
beforeAll(async () => {
  db = await openTestDb();
});

beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: 67109944,
    slug: "nse",
    discordGuildId: "1",
    leaderRoleIds: ["2"],
    memberRoleIds: ["3"],
  });
  ws = (await findWorkspaceBySlug(db, "nse"))?.id ?? 0;
});

/** The tick's sender at `now`, with Discord as the test context's stand-in. */
function sender(now: Date) {
  const { ctx, posts } = testContext(db, ENV);
  const deps = { env: ENV, fetch: ctx.fetch, now: () => now, report: ctx.report };
  return { send: () => sendDuePosts(db, deps, Number.MAX_SAFE_INTEGER), posts };
}

const MONDAY = "2026-11-30";
const MONDAY_0000 = new Date("2026-11-30T02:00:00Z"); // Mon 00:00 ST, after Sunday's 23:30 ST read
const MONDAY_0100 = new Date("2026-11-30T03:00:00Z"); // Mon 01:00 ST, the heartbeat
const SUNDAY_2300 = new Date("2026-11-30T01:00:00Z"); // Sun 23:00 ST, before the read

const NAMES = ["Ana Example", "Bo Example", "Cy Example", "Dee Example", "Eve Example"];

/** One day's roster of the alliance, with the private values the upstream sends in raw_json. */
const roster = (
  day: string,
  uids: number[],
  values: Partial<typeof dailyRosters.$inferInsert> = {},
) =>
  db.insert(dailyRosters).values({
    readDay: day,
    unionId: 67109944,
    memberCount: uids.length,
    totalPower: 9090909,
    sourceUpdatedAt: MONDAY_0000,
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((uid) => NAMES[uid % NAMES.length] as string),
    memberPower: uids.map(() => 4242000),
    memberKills: uids.map(() => 777),
    rawJson: {
      members: uids.map((uid) => ({
        uid,
        nick_name: NAMES[uid % NAMES.length],
        daily_tech: 31337,
        daily_honor: 888,
        active: 4321,
        x: 98765,
        y: 54321,
        online: true,
        last_online_at: 1763337600,
        avatar_url: "https://avatar.example.test/a.png",
      })),
    },
    ...values,
  });

/**
 * The week of Nov 23–29: 4 members the Sunday before; Monday +5; Tuesday's read failed; Wednesday −4, −5
 * (who joined and left inside the week counts in both); Sunday −2, +6, +7. Joined 3, left 3, from 4 to 4
 * members, 3 daily updates in the week.
 */
async function week() {
  await roster("2026-11-22", [1, 2, 3, 4]);
  await roster("2026-11-23", [1, 2, 3, 4, 5]);
  await roster("2026-11-24", [], { error: "timeout", isFresh: false });
  await roster("2026-11-25", [1, 2, 3]);
  await roster("2026-11-29", [1, 3, 6, 7]);
}

const turnSummaryOn = (values: Partial<typeof workspacePosts.$inferInsert> = {}) =>
  db.insert(workspacePosts).values({
    workspaceId: ws,
    postKey: "summary",
    on: true,
    channel: "leaders",
    updatedAt: MONDAY_0000,
    ...values,
  });

describe("Weekly members summary (D159, post 4)", () => {
  it("posts the week's counts to the leaders' channel once on Monday, however many ticks overlap", async () => {
    await turnSummaryOn();
    await week();
    const early = sender(SUNDAY_2300);
    await early.send();
    expect(early.posts).toEqual([]);

    const monday = sender(MONDAY_0000);
    await Promise.all([monday.send(), monday.send()]);
    await sender(MONDAY_0100).send();
    expect(monday.posts).toHaveLength(1);
    expect(monday.posts[0]?.url).toBe(HOOK);
    expect(monday.posts[0]?.content).toBe(
      [
        "**Members last week**",
        "",
        "Mon, Nov 23 to Sun, Nov 29",
        "Joined: 3",
        "Left: 3",
        "Members on Sun, Nov 22: 4",
        "Members on Sun, Nov 29: 4",
        "From 3 of 7 daily updates this week.",
      ].join("\n"),
    );
    expect(await db.select().from(postRuns)).toMatchObject([
      { postKey: "summary", period: MONDAY, status: "posted", sent: 1, attempts: 1 },
    ]);
  });

  it("posts nothing and settles the week when there is no usable roster before the week to compare", async () => {
    await turnSummaryOn();
    await roster("2026-11-22", [1, 2, 3, 4], { isFresh: false });
    await roster("2026-11-14", [1, 2]); // more than 7 days before the week
    await roster("2026-11-29", [1, 2, 3]);
    const { send, posts } = sender(MONDAY_0000);
    await send();
    expect(posts).toEqual([]);
    expect(await db.select().from(postRuns)).toMatchObject([
      { postKey: "summary", period: MONDAY, status: "skipped" },
    ]);
  });

  it("sends nothing while its switch is off or the owner does not allow it, and goes once both say on", async () => {
    await week();
    await turnSummaryOn({ on: false });
    const off = sender(MONDAY_0000);
    await off.send();
    expect(off.posts).toEqual([]);

    await db.update(workspacePosts).set({ on: true });
    await setSwitch(db, ws, "post_summary", false, MONDAY_0000);
    const disallowed = sender(MONDAY_0000);
    await disallowed.send();
    expect(disallowed.posts).toEqual([]);
    expect(await db.select().from(postRuns)).toEqual([]);

    await setSwitch(db, ws, "post_summary", true, MONDAY_0000);
    const on = sender(MONDAY_0100);
    await on.send();
    expect(on.posts).toHaveLength(1);
  });

  it("shows on the card on Monday, 00:00 to 01:15 ST, for the leaders' channel only", async () => {
    const access = {
      workspaceId: ws,
      features: { on: new Set(["post_summary"]) },
    } as unknown as WorkspaceAccess;
    const channels = [
      { channel: "leaders", state: "set", name: "officers", forum: false, savedAt: null },
    ] as const;
    const env = testContext(db, ENV).ctx.env;
    const rows = await postsView(db, access, [...channels], env, "en");
    expect(rows).toMatchObject([
      {
        post: "summary",
        channel: "leaders",
        day: "Monday",
        from: "00:00",
        to: "01:15",
        channels: [{ channel: "leaders", name: "officers" }],
      },
    ]);
  });

  it("carries no name, no private field, no coin, quest or donation value and no ping", async () => {
    await week();
    await turnSummaryOn({ language: "pt-BR", title: "Membros @here" });
    const { send, posts } = sender(MONDAY_0000);
    await send();
    expect(posts).toHaveLength(1);
    const content = String(posts[0]?.content);
    /** The sentinel scan: private values, coins, quests, donations, power, kills, names and live pings. */
    const leaks = (text: string) =>
      [
        ...PRIVATE_MARKERS,
        "31337",
        "888",
        "4321",
        "4242000",
        "9090909",
        "777",
        ...NAMES,
        "@everyone",
        "@here",
        "<@",
      ].filter((s) => text.includes(s));
    // Positive control: the scan finds what it looks for.
    expect(leaks("Ana Example 31337 888 4321 @here")).toEqual([
      "31337",
      "888",
      "4321",
      "Ana Example",
      "@here",
    ]);
    expect(leaks(content)).toEqual([]);
    expect(content).toContain("Entraram: 3\nSaíram: 3");
    expect(posts[0]?.body.allowed_mentions).toEqual({ parse: [] });
  });
});
