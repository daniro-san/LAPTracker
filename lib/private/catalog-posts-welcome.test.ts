// The catalog's post 3, "Welcome new members" (D159 amendment 2026-11-23, issue 713 part D), against a real
// Postgres (PGlite): every day after the 23:30 ST end-of-day read it names the members in the day's roster who
// were not in the day before's, never who left, and gives a count above 15. It goes once a day however many
// ticks overlap, only while the owner allows it and the alliance has it on, and posts nothing while either
// day's read failed, is stale or is still running, or when no one is new. No private field, no other roster
// value and no ping reach Discord. Invented names only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { testContext, TEST_ENV } from "../app-context.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { setSwitch } from "../repo/workspace-features";
import { findWorkspaceBySlug, saveWorkspace } from "../repo/workspaces";
import { dailyReads, dailyRosters } from "../schema";
import { postRuns, workspacePosts } from "../schema-discord";
import { PRIVATE_MARKERS } from "../workspace-data.test-helpers";
import { sendDuePosts, welcomeText } from "./catalog-posts";

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

/** The tick's sender at `now`, with Discord as the test context's stand-in. */
function sender(now: Date) {
  const { ctx, posts } = testContext(db, ENV);
  const deps = { env: ENV, fetch: ctx.fetch, now: () => now, report: ctx.report };
  return { send: () => sendDuePosts(db, deps, Number.MAX_SAFE_INTEGER), posts };
}

const MONDAY = "2026-11-23";
const TUESDAY = "2026-11-24";
const TUESDAY_2330 = new Date("2026-11-25T01:30:00Z"); // Tue 23:30 ST, the end-of-day read's tick
const TUESDAY_2345 = new Date("2026-11-25T01:45:00Z"); // Tue 23:45 ST, the read window's next tick

/** One day's end-of-day read and the alliance's roster in it, with the private values the upstream sends. */
async function readDay(
  day: string,
  members: [number, string][],
  roster: Partial<typeof dailyRosters.$inferInsert> = {},
  status: "running" | "complete" = "complete",
) {
  await db.insert(dailyReads).values({ day, startedAt: TUESDAY_2330, status });
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId: 67109944,
    memberCount: members.length,
    sourceUpdatedAt: TUESDAY_2330,
    isFresh: true,
    memberUids: members.map(([uid]) => uid),
    memberNames: members.map(([, name]) => name),
    memberPower: members.map(() => 4242000),
    memberKills: members.map(() => 777),
    rawJson: {
      members: members.map(([uid, nick_name]) => ({
        uid,
        nick_name,
        x: 98765,
        y: 54321,
        online: true,
        last_online_at: 1763337600,
        avatar_url: "https://avatar.example.test/a.png",
      })),
    },
    ...roster,
  });
}

const turnWelcomeOn = (values: Partial<typeof workspacePosts.$inferInsert> = {}) =>
  db.insert(workspacePosts).values({
    workspaceId: ws,
    postKey: "welcome",
    on: true,
    channel: "members",
    updatedAt: TUESDAY_2330,
    ...values,
  });

const MONDAY_ROSTER: [number, string][] = [
  [1, "Ana Example"],
  [2, "Bo Leaver"],
  [3, "Cy Stays"],
];
const TUESDAY_ROSTER: [number, string][] = [
  [1, "Ana Example"],
  [3, "Cy Stays"],
  [4, "Dee Newcomer"],
  [5, "Eve Newcomer"],
];

describe("Welcome new members (D159, post 3)", () => {
  it("names who joined since yesterday's roster and never who left, once a day however many ticks overlap", async () => {
    await turnWelcomeOn();
    await readDay(MONDAY, MONDAY_ROSTER);
    await readDay(TUESDAY, TUESDAY_ROSTER);
    const early = sender(new Date("2026-11-25T01:15:00Z")); // Tue 23:15 ST, before the read
    await early.send();
    expect(early.posts).toEqual([]);

    const tuesday = sender(TUESDAY_2330);
    await Promise.all([tuesday.send(), tuesday.send()]);
    await sender(TUESDAY_2345).send();
    expect(tuesday.posts).toHaveLength(1);
    expect(tuesday.posts[0]?.url).toBe(HOOK);
    expect(tuesday.posts[0]?.content).toBe(
      [
        "**Welcome to our new members**",
        "",
        "Welcome, Dee Newcomer and Eve Newcomer! We’re glad you’re here. Say hello, and ask us anything you need.",
      ].join("\n"),
    );
    expect(tuesday.posts[0]?.content).not.toContain("Bo Leaver");
    expect(await db.select().from(postRuns)).toMatchObject([
      { postKey: "welcome", period: TUESDAY, status: "posted", sent: 1, attempts: 1 },
    ]);
  });

  it("gives a count instead of names above 15 new members, and names up to 15", async () => {
    const newcomers = (n: number) => Array.from({ length: n }, (_, i) => `Newcomer ${i + 1}`);
    expect(welcomeText(newcomers(15), "en")).toContain("Newcomer 1, Newcomer 2,");
    expect(welcomeText(newcomers(15), "en")).toContain("Newcomer 14, and Newcomer 15!");

    await turnWelcomeOn();
    await readDay(MONDAY, [[1, "Ana Example"]]);
    await readDay(TUESDAY, [
      [1, "Ana Example"],
      ...newcomers(16).map((name, i): [number, string] => [100 + i, name]),
    ]);
    const { send, posts } = sender(TUESDAY_2330);
    await send();
    expect(posts).toHaveLength(1);
    expect(posts[0]?.content).toBe(
      [
        "**Welcome to our new members**",
        "",
        "Welcome to our 16 new members! We’re glad you’re here. Say hello, and ask us anything you need.",
      ].join("\n"),
    );
  });

  it("posts nothing while a read failed, is stale or still running, and settles a day with no one new", async () => {
    await turnWelcomeOn();
    const nothing = async () => {
      const tick = sender(TUESDAY_2330);
      await tick.send();
      expect(tick.posts).toEqual([]);
    };
    const reset = async () => {
      await db.delete(dailyRosters);
      await db.delete(dailyReads);
    };
    // Yesterday's read failed: everyone today would look new.
    await readDay(MONDAY, [], { error: "timeout", isFresh: false });
    await readDay(TUESDAY, TUESDAY_ROSTER);
    await nothing();
    // Today's read failed.
    await reset();
    await readDay(MONDAY, MONDAY_ROSTER);
    await readDay(TUESDAY, [], { error: "timeout", isFresh: false });
    await nothing();
    // Yesterday's roster is stale: an older roster than the day's.
    await reset();
    await readDay(MONDAY, MONDAY_ROSTER.slice(0, 1), { isFresh: false });
    await readDay(TUESDAY, TUESDAY_ROSTER);
    await nothing();
    // Today's read is still running in another tick.
    await reset();
    await readDay(MONDAY, MONDAY_ROSTER);
    await readDay(TUESDAY, TUESDAY_ROSTER, {}, "running");
    await nothing();
    // None of these settled the day: the read's retry may still come.
    expect(await db.select().from(postRuns)).toEqual([]);

    // Someone left and no one joined: nothing is posted, and the day is settled.
    await reset();
    await readDay(MONDAY, MONDAY_ROSTER);
    await readDay(TUESDAY, MONDAY_ROSTER.slice(0, 2));
    await nothing();
    expect(await db.select().from(postRuns)).toMatchObject([
      { postKey: "welcome", period: TUESDAY, status: "skipped" },
    ]);
  });

  it("sends nothing while its switch is off or the owner does not allow it, and goes once both say on", async () => {
    await readDay(MONDAY, MONDAY_ROSTER);
    await readDay(TUESDAY, TUESDAY_ROSTER);
    await turnWelcomeOn({ on: false });
    const off = sender(TUESDAY_2330);
    await off.send();
    expect(off.posts).toEqual([]);

    await db.update(workspacePosts).set({ on: true });
    await setSwitch(db, ws, "post_welcome", false, TUESDAY_2330);
    const disallowed = sender(TUESDAY_2330);
    await disallowed.send();
    expect(disallowed.posts).toEqual([]);
    expect(await db.select().from(postRuns)).toEqual([]);

    await setSwitch(db, ws, "post_welcome", true, TUESDAY_2330);
    const on = sender(TUESDAY_2345);
    await on.send();
    expect(on.posts).toHaveLength(1);
  });

  it("carries no private field, no other roster value and no ping, in the post's language", async () => {
    await readDay(MONDAY, MONDAY_ROSTER);
    await readDay(TUESDAY, [...TUESDAY_ROSTER, [6, "Zed @everyone <@123>"]]);
    await turnWelcomeOn({ language: "pt-BR", title: "Bem-vindos @here" });
    const { send, posts } = sender(TUESDAY_2330);
    await send();
    expect(posts).toHaveLength(1);
    const content = String(posts[0]?.content);
    /** The sentinel scan: the roster's private values, its power and kills, who left, and a live ping. */
    const leaks = (text: string) =>
      [...PRIVATE_MARKERS, "4242000", "777", "Bo Leaver", "@everyone", "@here", "<@1"].filter((s) =>
        text.includes(s),
      );
    // Positive control: the scan finds what it looks for.
    expect(leaks("Bo Leaver 4242000 @everyone x 98765")).toEqual([
      "98765",
      "4242000",
      "Bo Leaver",
      "@everyone",
    ]);
    expect(leaks(content)).toEqual([]);
    expect(content).toBe(
      [
        "**Bem-vindos @\u200bhere**",
        "",
        "Boas-vindas, Dee Newcomer, Eve Newcomer e Zed @\u200beveryone <@\u200b123>! Que bom ter vocês aqui. Digam oi e perguntem o que precisarem.",
      ].join("\n"),
    );
    expect(posts[0]?.body.allowed_mentions).toEqual({ parse: [] });
  });
});
