// The catalog's post 1, "This week in the alliance" (#713 part C, D159), against a real Postgres (PGlite): it
// goes out once on Monday however many ticks overlap, only while the owner allows it and the alliance has it
// on, and it holds the week's calendar entries members can see with their server times: no roster field, no
// person, no note, no link, and it pings no one. The claim comes after the post is built, an empty week is
// settled without a post, and the tick's deadline stops new sends. Post 2, the shield-up reminder, goes once
// on Friday from 20:30 ST, with the Raid Shield check off too, and names, counts and pings no one. Invented
// names only.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { testContext, TEST_ENV } from "../app-context.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { POST_CATALOG } from "../post-catalog";
import { liveCallout } from "../repo/post-touches";
import { setSwitch } from "../repo/workspace-features";
import { findWorkspaceBySlug, saveWorkspace } from "../repo/workspaces";
import { calendarEntries, calendarOccurrences } from "../schema";
import { postRuns, workspacePosts, workspacePostTouches } from "../schema-discord";
import { PRIVATE_MARKERS, seedRoster } from "../workspace-data.test-helpers";
import { sendDuePosts } from "./catalog-posts";
import { sendBy } from "./post-settings";

// The real read of the alliance's line, which one test makes fail once.
vi.mock("../repo/post-touches", async (original) => {
  const real = await original<typeof import("../repo/post-touches")>();
  return { ...real, liveCallout: vi.fn(real.liveCallout) };
});

/** No deadline in reach, and one already passed. */
const OPEN = Number.MAX_SAFE_INTEGER;
const PASSED = 0;

const MONDAY = "2026-11-23";
const MONDAY_0000 = new Date("2026-11-23T02:00:00Z"); // Mon 00:00 ST, after Sunday's 23:30 ST read
const SUNDAY_2300 = new Date("2026-11-23T01:00:00Z"); // Sun 23:00 ST
const HOOK = "https://discord.com/api/webhooks/9000/nse-members";
const ENV = {
  ...TEST_ENV,
  WORKSPACE_DISCORD_WEBHOOKS: { nse: { members: { url: HOOK, name: "members", forum: false } } },
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

const turnOn = (on = true, title = "") =>
  db.insert(workspacePosts).values({
    workspaceId: ws,
    postKey: "week",
    on,
    channel: "members",
    title,
    updatedAt: MONDAY_0000,
  });

/** One entry of this week; members see it unless said otherwise. */
const entry = (values: Partial<typeof calendarEntries.$inferInsert>) =>
  db
    .insert(calendarEntries)
    .values({
      workspaceId: ws,
      kind: "kvk",
      day: "2026-11-28",
      minute: 720,
      forMembers: true,
      ...values,
    })
    .returning({ id: calendarEntries.id });

/** The tick's sender at `now`, with Discord as the test context's stand-in (or `fetch`). */
function sender(now: Date, fetch?: typeof globalThis.fetch, deadline = OPEN) {
  const { ctx, posts } = testContext(db, ENV);
  const deps = { env: ENV, fetch: fetch ?? ctx.fetch, now: () => now, report: ctx.report };
  return { send: () => sendDuePosts(db, deps, deadline), posts };
}

describe("This week in the alliance (D159)", () => {
  it("goes out once on Monday with the week members can see, however many ticks overlap", async () => {
    await turnOn();
    await entry({ kind: "cheese", variant: "I", level: 7, day: "2026-11-23", minute: 1080 });
    await entry({ kind: "undead", level: 6, day: "2026-11-25", minute: 1200 });
    await entry({});
    await entry({
      kind: "other",
      title: "Officers only plan",
      day: "2026-11-24",
      forMembers: false,
    });
    const sunday = sender(SUNDAY_2300);
    await sunday.send();
    expect(sunday.posts).toEqual([]);

    const monday = sender(MONDAY_0000);
    // cron-job.org's tick and tick.yml's, at the same time, then a later tick of the same Monday.
    await Promise.all([monday.send(), monday.send()]);
    await sender(new Date("2026-11-23T05:00:00Z")).send(); // Mon 03:00 ST
    expect(monday.posts).toHaveLength(1);
    const [post] = monday.posts;
    expect(post?.url).toBe(HOOK);
    expect(post?.content).toBe(
      [
        "**This week in the alliance**",
        "",
        "Monday, November 23",
        "18:00 ST · Cheese Trap I · Lv.7",
        "",
        "Wednesday, November 25",
        "20:00 ST · Undead Siege · Lv.6",
        "",
        "Saturday, November 28",
        "12:00 ST · KvK",
      ].join("\n"),
    );
    expect(post?.body.allowed_mentions).toEqual({ parse: [] });
    expect(await db.select().from(postRuns)).toMatchObject([
      { postKey: "week", period: MONDAY, status: "posted", sent: 1, attempts: 1 },
    ]);
  });

  it("sends nothing while the alliance's switch is off or the owner does not allow it", async () => {
    await entry({});
    await turnOn(false);
    const off = sender(MONDAY_0000);
    await off.send();
    expect(off.posts).toEqual([]);

    await db.update(workspacePosts).set({ on: true });
    await setSwitch(db, ws, "post_week", false, MONDAY_0000);
    const disallowed = sender(MONDAY_0000);
    await disallowed.send();
    expect(disallowed.posts).toEqual([]);
    // Nothing was claimed, so the week still goes out once both layers say on.
    expect(await db.select().from(postRuns)).toEqual([]);
    await setSwitch(db, ws, "post_week", true, MONDAY_0000);
    const on = sender(MONDAY_0000);
    await on.send();
    expect(on.posts).toHaveLength(1);
  });

  it("names no one, links nothing and pings no one: no roster field, seat, note or link", async () => {
    await seedRoster(db, 67109944);
    await turnOn(true, "Week of evil.example/login");
    const [caravan] = await entry({
      kind: "caravan",
      day: "2026-11-26",
      minute: 600,
      notes: "Ana Example drives, coords 98765",
      link: "https://evil.example/join",
    });
    await db.insert(calendarOccurrences).values({
      workspaceId: ws,
      entryId: caravan?.id ?? 0,
      week: MONDAY,
      coachUid: 101,
      coachName: "Ana Example",
    });
    await entry({ kind: "other", title: "@everyone <@101> meet at https://evil.example/x" });
    const { send, posts } = sender(MONDAY_0000);
    await send();
    expect(posts).toHaveLength(1);
    const body = JSON.stringify(posts[0]?.body);
    /** The sentinel scan: the roster's private values, the member's name, the note and a live link. */
    const leaks = (text: string) =>
      [...PRIVATE_MARKERS, "Ana Example", "evil.example", "@everyone", "<@101>"].filter((s) =>
        text.includes(s),
      );
    // Positive control: the scan finds what it looks for.
    expect(leaks("Ana Example at 98765, see evil.example @everyone")).toEqual([
      "98765",
      "Ana Example",
      "evil.example",
      "@everyone",
    ]);
    expect(leaks(body)).toEqual([]);
    expect(posts[0]?.content).toContain("10:00 ST · Alliance Caravan");
    expect(posts[0]?.content).toContain("@\u200Beveryone");
    expect(posts[0]?.body.allowed_mentions).toEqual({ parse: [] });
  });

  it("splits a long week under 2,000 characters, and a forum post takes the title", async () => {
    await turnOn();
    for (let i = 0; i < 40; i++)
      await entry({ kind: "other", title: `Practice run ${i} ${"x".repeat(60)}`, minute: i });
    const sent: { url: string; body: Record<string, unknown> }[] = [];
    const forum: typeof fetch = async (input, init) => {
      sent.push({
        url: String(input),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return Response.json({ id: String(sent.length), channel_id: "777" });
    };
    const env = {
      ...ENV,
      WORKSPACE_DISCORD_WEBHOOKS: { nse: { members: { url: HOOK, name: "members", forum: true } } },
    };
    const { ctx } = testContext(db, env);
    const deps = { env, fetch: forum, now: () => MONDAY_0000, report: ctx.report };
    await sendDuePosts(db, deps, OPEN);
    expect(sent.length).toBeGreaterThan(1);
    for (const s of sent) expect(String(s.body.content).length).toBeLessThanOrEqual(2000);
    expect(sent[0]?.body.thread_name).toBe("This week in the alliance");
    // The forum post's title is its name, so the first message does not repeat it; the rest go inside it.
    expect(String(sent[0]?.body.content)).not.toContain("**This week in the alliance**");
    expect(sent.slice(1).every((s) => s.url.endsWith("&thread_id=777"))).toBe(true);
  });

  it("tries a send Discord refused again, up to 3 times, and never one Discord did not answer", async () => {
    await turnOn();
    await entry({});
    let calls = 0;
    const refusing: typeof fetch = async () => {
      calls++;
      return new Response(null, { status: 503 });
    };
    for (let tick = 0; tick < 5; tick++) await sender(MONDAY_0000, refusing).send();
    expect(calls).toBe(3);
    expect(await db.select().from(postRuns)).toMatchObject([
      { status: "failed", sent: 0, attempts: 3 },
    ]);

    // A timeout may still have posted: the next ticks leave it, so the week is never doubled.
    await db.delete(postRuns);
    calls = 0;
    const silent: typeof fetch = async () => {
      calls++;
      throw new DOMException("The operation timed out.", "TimeoutError");
    };
    for (let tick = 0; tick < 3; tick++) await sender(MONDAY_0000, silent).send();
    expect(calls).toBe(1);
    expect(await db.select().from(postRuns)).toMatchObject([
      { status: "unanswered", sent: 0, attempts: 1 },
    ]);

    // A send that got part way (one message of two reached Discord) is never taken again.
    await db.delete(postRuns);
    await db.insert(postRuns).values({
      workspaceId: ws,
      postKey: "week",
      period: MONDAY,
      status: "failed",
      sent: 1,
      at: MONDAY_0000,
    });
    const partly = sender(MONDAY_0000);
    await partly.send();
    expect(partly.posts).toEqual([]);
    expect(await db.select().from(postRuns)).toMatchObject([
      { status: "failed", sent: 1, attempts: 1 },
    ]);
  });

  it("posts nothing in a week with no entry for members, and settles that week", async () => {
    await turnOn();
    await entry({ kind: "other", title: "Officers only plan", forMembers: false });
    const monday = sender(MONDAY_0000);
    await monday.send();
    expect(monday.posts).toEqual([]);
    expect(await db.select().from(postRuns)).toMatchObject([
      { period: MONDAY, status: "skipped", sent: 0 },
    ]);
    // Settled: a later tick of the same Monday reads nothing more for it, even with an entry added since.
    await entry({});
    const later = sender(new Date("2026-11-23T05:00:00Z")); // Mon 03:00 ST
    await later.send();
    expect(later.posts).toEqual([]);
  });

  it("opens with the alliance's own line, above our title (D156)", async () => {
    await turnOn();
    await entry({});
    await db.insert(workspacePostTouches).values({
      workspaceId: ws,
      postKey: "week",
      callout: "Let's go, family @everyone",
      updatedAt: MONDAY_0000,
    });
    const { send, posts } = sender(MONDAY_0000);
    await send();
    expect(String(posts[0]?.content).split("\n").slice(0, 2)).toEqual([
      "Let's go, family @\u200Beveryone",
      "**This week in the alliance**",
    ]);
  });

  it("claims the week only once the post is built: a build that throws leaves it to the next tick", async () => {
    await turnOn();
    await entry({});
    vi.mocked(liveCallout).mockRejectedValueOnce(new Error("connection lost"));
    const failed = sender(MONDAY_0000);
    await failed.send();
    expect(failed.posts).toEqual([]);
    expect(await db.select().from(postRuns)).toEqual([]);
    const next = sender(new Date("2026-11-23T05:00:00Z")); // Mon 03:00 ST
    await next.send();
    expect(next.posts).toHaveLength(1);
  });

  it("starts no send once the tick's deadline is near, and leaves the week to the next tick", async () => {
    await turnOn();
    await entry({});
    const late = sender(MONDAY_0000, undefined, PASSED);
    await late.send();
    expect(late.posts).toEqual([]);
    expect(await db.select().from(postRuns)).toEqual([]);
    const next = sender(MONDAY_0000);
    await next.send();
    expect(next.posts).toHaveLength(1);
  });
});

// Post 2 (D159 amendment 2026-11-23): Friday from 20:30 ST, 3 hours before the night check (D137).
const FRIDAY = "2026-11-27";
const FRIDAY_2030 = new Date("2026-11-27T22:30:00Z"); // Fri 20:30 ST
const SHIELD_UP_EN = [
  "**Shield up before the reset**",
  "",
  "Raid tonight at the reset (00:00 ST). Before then, please turn on your shield, take your squads off the wall and bring your troops home: a shield doesn’t protect troops outside. Thanks, everyone!",
].join("\n");

const turnShieldUpOn = (values: Partial<typeof workspacePosts.$inferInsert> = {}) =>
  db.insert(workspacePosts).values({
    workspaceId: ws,
    postKey: "shield_up",
    on: true,
    channel: "members",
    updatedAt: FRIDAY_2030,
    ...values,
  });

describe("Shield-up reminder (D159, post 2)", () => {
  it("goes out once on Friday from 20:30 ST, however many ticks overlap, with the Raid Shield check off", async () => {
    await turnShieldUpOn();
    // It does not lean on the check (D137): with the alliance's check off it still goes.
    await setSwitch(db, ws, "shield_check", false, FRIDAY_2030);
    for (const early of [
      new Date("2026-11-27T22:15:00Z"), // Fri 20:15 ST: the Friday check's tick, before the post's time
      new Date("2026-11-26T22:30:00Z"), // Thu 20:30 ST
      new Date("2026-11-23T22:30:00Z"), // Mon 20:30 ST
    ]) {
      const tick = sender(early);
      await tick.send();
      expect(tick.posts).toEqual([]);
    }

    const friday = sender(FRIDAY_2030);
    await Promise.all([friday.send(), friday.send()]);
    await sender(new Date("2026-11-28T00:00:00Z")).send(); // Fri 22:00 ST, the heartbeat
    await sender(new Date("2026-11-28T01:30:00Z")).send(); // Fri 23:30 ST, the night check
    expect(friday.posts).toHaveLength(1);
    expect(friday.posts[0]?.url).toBe(HOOK);
    expect(friday.posts[0]?.content).toBe(SHIELD_UP_EN);
    expect(await db.select().from(postRuns)).toMatchObject([
      { postKey: "shield_up", period: FRIDAY, status: "posted", sent: 1, attempts: 1 },
    ]);
    // Past the reset it is Saturday: a reminder that missed Friday never goes out after the raid began.
    await db.delete(postRuns);
    const saturday = sender(new Date("2026-11-28T02:15:00Z")); // Sat 00:15 ST
    await saturday.send();
    expect(saturday.posts).toEqual([]);
  });

  it("sends nothing while its switch is off or the owner does not allow it, and goes once both say on", async () => {
    await turnShieldUpOn({ on: false });
    const off = sender(FRIDAY_2030);
    await off.send();
    expect(off.posts).toEqual([]);

    await db.update(workspacePosts).set({ on: true });
    await setSwitch(db, ws, "post_shield_up", false, FRIDAY_2030);
    const disallowed = sender(FRIDAY_2030);
    await disallowed.send();
    expect(disallowed.posts).toEqual([]);
    expect(await db.select().from(postRuns)).toEqual([]);

    await setSwitch(db, ws, "post_shield_up", true, FRIDAY_2030);
    const on = sender(new Date("2026-11-28T00:00:00Z")); // Fri 22:00 ST
    await on.send();
    expect(on.posts).toHaveLength(1);
  });

  it("says on the card the tick slot it goes in: Friday 20:30–20:45 ST, Monday's week by 01:15 ST", () => {
    const { env } = testContext(db, ENV).ctx;
    expect(sendBy(env, FRIDAY, POST_CATALOG.shield_up.from)).toBe("20:45");
    expect(sendBy(env, MONDAY, POST_CATALOG.week.from)).toBe("01:15");
  });

  it("names no one, counts nothing and pings no one, in the post's language", async () => {
    await seedRoster(db, 67109944);
    await turnShieldUpOn({ language: "pt-BR", title: "Escudos @everyone" });
    const { send, posts } = sender(FRIDAY_2030);
    await send();
    expect(posts).toHaveLength(1);
    const content = String(posts[0]?.content);
    /** The sentinel scan: the roster's private values and name, a ping, and any number but the reset. */
    const leaks = (text: string) => [
      ...[...PRIVATE_MARKERS, "Ana Example", "@everyone", "<@"].filter((s) => text.includes(s)),
      ...(text.replaceAll("00:00", "").match(/\d+/g) ?? []),
    ];
    // Positive control: the scan finds what it looks for.
    expect(leaks("Ana Example: 12 of 97 shields, 00:00 ST, @everyone")).toEqual([
      "Ana Example",
      "@everyone",
      "12",
      "97",
    ]);
    expect(leaks(content)).toEqual([]);
    expect(content).toBe(
      [
        "**Escudos @​everyone**",
        "",
        "Raid hoje à noite, no reset (00:00 ST). Antes disso, por favor liguem o escudo, tirem os esquadrões da muralha e tragam as tropas para casa: o escudo não protege tropas fora da cidade. Obrigado, pessoal!",
      ].join("\n"),
    );
    expect(posts[0]?.body.allowed_mentions).toEqual({ parse: [] });
  });
});
