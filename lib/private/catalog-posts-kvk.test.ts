// The catalog's post 5, "KvK recap" (D159 amendment 2026-11-23, issue 713 part E), against a real Postgres
// (PGlite): on the KvK's day, once its End read has finished, it thanks the members' channel and gives the
// alliance's War turnout from Start to End and the 3 biggest kills gains by name. It goes once however many
// ticks overlap, waits while the End is running, only while the owner allows it and the alliance has it on,
// and posts nothing when the Start or the End could not be read. No one but the top 3 is named; no private
// field, might or ping reaches Discord. Invented names only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { testContext, TEST_ENV } from "../app-context.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { setSwitch } from "../repo/workspace-features";
import { findWorkspaceBySlug, saveWorkspace } from "../repo/workspaces";
import { allianceSnapshots, events, memberSnapshots, snapshots } from "../schema";
import { postRuns, workspacePosts } from "../schema-discord";
import { PRIVATE_MARKERS } from "../workspace-data.test-helpers";
import type { WorkspaceAccess } from "./access";
import { sendDuePosts } from "./catalog-posts";
import { postsView } from "./post-settings";

const OGS = 67109944;
const HOOK = "https://discord.com/api/webhooks/9000/nse-members";
const ENV = {
  ...TEST_ENV,
  WORKSPACE_DISCORD_WEBHOOKS: { nse: { members: { url: HOOK, name: "general", forum: false } } },
};

let db: Db;
let ws = 0;
beforeAll(async () => {
  db = await openTestDb();
});

beforeEach(async () => {
  await truncateAll(db);
  await saveWorkspace(db, {
    unionId: OGS,
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

// The test schedule: Saturday 12:00 ST, Start 10:00 ST, End 14:00 ST (ST = UTC−2).
const SATURDAY = "2026-11-28";
const SAT_1345 = new Date("2026-11-28T15:45:00Z"); // before the End
const SAT_1400 = new Date("2026-11-28T16:00:00Z"); // the End's tick
const SAT_1415 = new Date("2026-11-28T16:15:00Z");

/** Ana to Eve in both rosters, Fay joined at the End, Gus left: kills at Start and End, might 4242000. */
const START: Record<number, [string, number]> = {
  1: ["Ana Example", 10_000_000],
  2: ["Bo Example", 5_000_000],
  3: ["Cy Example", 3_000_000],
  4: ["Dee Example", 2_000_000],
  5: ["Eve Example", 100],
  7: ["Gus Example", 50_000_000],
};
const END: Record<number, [string, number]> = {
  1: ["Ana Example", 13_000_000],
  2: ["Bo Example", 7_000_000],
  3: ["Cy Example", 4_000_000],
  4: ["Dee Example", 2_500_000],
  5: ["Eve Example", 90],
  6: ["Fay Example", 99_000_000],
};
const NAMES = ["Ana Example", "Bo Example", "Cy Example", "Dee Example", "Eve Example"];

/** The Saturday event, its Start and its End (status `end`), and the alliance's rows in each. */
async function kvk(end: "complete" | "running" = "complete", endRow = { isFresh: true }) {
  const [event] = await db
    .insert(events)
    .values({
      name: "Saturday Event 2026-11-28",
      eventAtUtc: new Date("2026-11-28T14:00:00Z"),
      allianceIds: [OGS],
      beforeAt: new Date("2026-11-28T12:00:00Z"),
      afterAt: SAT_1400,
    })
    .returning({ id: events.id });
  for (const [phase, status, members, row] of [
    ["before", "complete", START, { isFresh: true }],
    ["after", end, END, endRow],
  ] as const) {
    const [snap] = await db
      .insert(snapshots)
      .values({ eventId: event?.id ?? 0, phase, startedAt: SAT_1345, status })
      .returning({ id: snapshots.id });
    const [alliance] = await db
      .insert(allianceSnapshots)
      .values({
        snapshotId: snap?.id ?? 0,
        unionId: OGS,
        source: "v1",
        totalPower: 9090909,
        rawJson: { members: [{ x: 98765, y: 54321, last_online_at: 1763337600 }] },
        ...row,
      })
      .returning({ id: allianceSnapshots.id });
    await db.insert(memberSnapshots).values(
      Object.entries(members).map(([uid, [name, kills]]) => ({
        allianceSnapshotId: alliance?.id ?? 0,
        uid: Number(uid),
        name,
        power: 4242000,
        kills,
        avatarUrl: "https://avatar.example.test/a.png",
      })),
    );
  }
}

const turnKvkOn = (values: Partial<typeof workspacePosts.$inferInsert> = {}) =>
  db.insert(workspacePosts).values({
    workspaceId: ws,
    postKey: "kvk",
    on: true,
    channel: "members",
    updatedAt: SAT_1345,
    ...values,
  });

describe("KvK recap (D159, post 5)", () => {
  it("thanks the members' channel once after the End, with the totals and the top 3, however many ticks overlap", async () => {
    await turnKvkOn();
    await kvk();
    const early = sender(SAT_1345);
    await early.send();
    expect(early.posts).toEqual([]);

    const end = sender(SAT_1400);
    await Promise.all([end.send(), end.send()]);
    await sender(SAT_1415).send();
    expect(end.posts).toHaveLength(1);
    expect(end.posts[0]?.url).toBe(HOOK);
    expect(end.posts[0]?.content).toBe(
      [
        "**KvK recap**",
        "",
        "Thank you, everyone, for this KvK!",
        "",
        "Kills gained together: 6.50M",
        "Members with kills gained: 4 of 5",
        "",
        "Biggest kills gains:",
        "1. Ana Example +3.00M",
        "2. Bo Example +2.00M",
        "3. Cy Example +1.00M",
        "",
        "Defenders and support players gain no kills, and they count just as much. Well done, all of you!",
      ].join("\n"),
    );
    expect(await db.select().from(postRuns)).toMatchObject([
      { postKey: "kvk", period: SATURDAY, status: "posted", sent: 1, attempts: 1 },
    ]);
  });

  it("waits while the End is running, without settling the day", async () => {
    await turnKvkOn();
    await kvk("running");
    const running = sender(SAT_1400);
    await running.send();
    expect(running.posts).toEqual([]);
    expect(await db.select().from(postRuns)).toEqual([]);

    await db.update(snapshots).set({ status: "complete" });
    const done = sender(SAT_1415);
    await done.send();
    expect(done.posts).toHaveLength(1);
  });

  it("posts nothing and settles the KvK when the alliance's End row is stale", async () => {
    await turnKvkOn();
    await kvk("complete", { isFresh: false });
    const { send, posts } = sender(SAT_1400);
    await send();
    expect(posts).toEqual([]);
    expect(await db.select().from(postRuns)).toMatchObject([
      { postKey: "kvk", period: SATURDAY, status: "skipped" },
    ]);
  });

  it("sends nothing while its switch is off or the owner does not allow it, and goes once both say on", async () => {
    await kvk();
    await turnKvkOn({ on: false });
    const off = sender(SAT_1400);
    await off.send();
    expect(off.posts).toEqual([]);

    await db.update(workspacePosts).set({ on: true });
    await setSwitch(db, ws, "post_kvk", false, SAT_1345);
    const disallowed = sender(SAT_1400);
    await disallowed.send();
    expect(disallowed.posts).toEqual([]);
    expect(await db.select().from(postRuns)).toEqual([]);

    await setSwitch(db, ws, "post_kvk", true, SAT_1345);
    const on = sender(SAT_1415);
    await on.send();
    expect(on.posts).toHaveLength(1);
  });

  it("shows on the card on the KvK's weekday, from the End's time, for the members' channel only", async () => {
    const access = {
      workspaceId: ws,
      features: { on: new Set(["post_kvk"]) },
    } as unknown as WorkspaceAccess;
    const channels = [
      { channel: "members", state: "set", name: "general", forum: false, savedAt: null },
    ] as const;
    const env = testContext(db, ENV).ctx.env;
    const rows = await postsView(db, access, [...channels], env, "en");
    expect(rows).toMatchObject([
      {
        post: "kvk",
        channel: "members",
        day: "Saturday",
        from: "14:00",
        to: "14:15",
        channels: [{ channel: "members", name: "general" }],
      },
    ]);
  });

  it("names only the top 3 and carries no private field, might, bottom list or ping", async () => {
    await kvk();
    await turnKvkOn({ language: "pt-BR", title: "KvK @everyone" });
    const { send, posts } = sender(SAT_1400);
    await send();
    expect(posts).toHaveLength(1);
    const content = String(posts[0]?.content);
    /** The sentinel scan: private values, might, the rest of the roster (gainer 4, a fall, a joiner, a leaver), pings. */
    const leaks = (text: string) =>
      [
        ...PRIVATE_MARKERS,
        "4242000",
        "4,24M",
        "9090909",
        "Dee Example",
        "Eve Example",
        "Fay Example",
        "Gus Example",
        "@everyone",
        "@here",
        "<@",
      ].filter((s) => text.includes(s));
    // Positive control: the scan finds what it looks for.
    expect(leaks("Dee Example 98765 4242000 @everyone")).toEqual([
      "98765",
      "4242000",
      "Dee Example",
      "@everyone",
    ]);
    expect(leaks(content)).toEqual([]);
    expect(NAMES.slice(0, 3).every((name) => content.includes(name))).toBe(true);
    expect(content).toContain("Kills ganhos juntos: 6,50M\nMembros com kills ganhos: 4 de 5");
    expect(posts[0]?.body.allowed_mentions).toEqual({ parse: [] });
  });
});
