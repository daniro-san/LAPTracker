// The catalog's post 1, "This week in the alliance" (#713 part C, D159), against a real Postgres (PGlite): it
// goes out once on Monday however many ticks overlap, only while the owner allows it and the alliance has it
// on, and it holds the week's calendar entries members can see with their server times: no roster field, no
// person, no note, no link, and it pings no one. Invented names only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { testContext, TEST_ENV } from "../app-context.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { setSwitch } from "../repo/workspace-features";
import { findWorkspaceBySlug, saveWorkspace } from "../repo/workspaces";
import { calendarEntries, calendarOccurrences } from "../schema";
import { postRuns, workspacePosts } from "../schema-discord";
import { PRIVATE_MARKERS, seedRoster } from "../workspace-data.test-helpers";
import { sendDuePosts } from "./catalog-posts";

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
function sender(now: Date, fetch?: typeof globalThis.fetch) {
  const { ctx, posts } = testContext(db, ENV);
  const deps = { env: ENV, fetch: fetch ?? ctx.fetch, now: () => now, report: ctx.report };
  return { send: () => sendDuePosts(db, deps), posts };
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
    await sendDuePosts(db, { env, fetch: forum, now: () => MONDAY_0000, report: ctx.report });
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
  });
});
