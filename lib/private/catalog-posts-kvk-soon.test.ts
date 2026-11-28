// The catalog's post 6, "KvK reminder" (issue 831, D159 and D161 amendments 2026-11-28), against a real
// Postgres (PGlite): 60 and 15 minutes before the KvK in the calendar, the members' channel gets its time
// and the plan's roles with the confirmed people by name, once per mark, only while the owner allows it and
// the alliance has it on, and never on an Origin of Chaos day. A member who only asked is not named, and
// the officers' note stays out. Invented names only.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { testContext, TEST_ENV } from "../app-context.test-helpers";
import type { Db } from "../db";
import { openTestDb, truncateAll } from "../db.test-helpers";
import { setSwitch } from "../repo/workspace-features";
import { findWorkspaceBySlug, saveWorkspace } from "../repo/workspaces";
import { calendarEntries, dailyReads, dailyRosters, kvkClaims, kvkPlans } from "../schema";
import { postRuns, workspacePosts } from "../schema-discord";
import type { WorkspaceAccess } from "./access";
import { sendDuePosts } from "./catalog-posts";
import { postsView } from "./post-settings";

const OGS = 67109955;
const HOOK = "https://discord.com/api/webhooks/9000/nse-members";
const ENV = {
  ...TEST_ENV,
  WORKSPACE_DISCORD_WEBHOOKS: { nse: { members: { url: HOOK, name: "general", forum: false } } },
};

// The test schedule: Saturday, Before 10:00 ST (ST = UTC−2); the KvK in the calendar at 12:00 ST.
const SATURDAY = "2026-11-28";
const at = (day: string, utc: string) => new Date(`${day}T${utc}:00Z`);

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
  const now = at(SATURDAY, "00:00");
  await db.insert(dailyReads).values({ day: "2026-11-27", startedAt: now, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-27",
    unionId: OGS,
    memberCount: 3,
    isFresh: true,
    sourceUpdatedAt: now,
    memberUids: [1, 2, 3],
    memberNames: ["Ana Example", "Bo Example", "Cy Example"],
    memberPower: [1, 1, 1],
    memberKills: [0, 0, 0],
  });
});

/** A KvK at 12:00 ST on `day`: Bo confirmed in Castle defence, Cy only asked for Scout, and a note. */
async function kvkOn(day: string) {
  const [entry] = await db
    .insert(calendarEntries)
    .values({ workspaceId: ws, kind: "kvk", day, minute: 720 })
    .returning({ id: calendarEntries.id });
  const entryId = entry?.id ?? 0;
  const roles = [
    { name: "Castle defence", uids: [2] },
    { name: "Scout", uids: [] },
  ];
  await db
    .insert(kvkPlans)
    .values({ workspaceId: ws, entryId, roles, note: "Meet at the gate", rev: 1 });
  await db.insert(kvkClaims).values({
    workspaceId: ws,
    entryId,
    role: "Scout",
    uid: 3,
    askedAt: at(day, "00:00"),
  });
}

const turnOn = () =>
  db.insert(workspacePosts).values({
    workspaceId: ws,
    postKey: "kvk_soon",
    on: true,
    channel: "members",
    updatedAt: at(SATURDAY, "00:00"),
  });

/** The tick's sender at `now`, with Discord as the test context's stand-in. */
async function tickAt(now: Date) {
  const { ctx, posts } = testContext(db, ENV);
  const deps = { env: ENV, fetch: ctx.fetch, now: () => now, report: ctx.report };
  await sendDuePosts(db, deps, Number.MAX_SAFE_INTEGER);
  return posts.map((p) => String(p.content));
}

describe("KvK reminder (D159, post 6)", () => {
  it("reminds the members' channel once at T-60 and once at T-15, with the confirmed roles by name", async () => {
    await turnOn();
    await kvkOn(SATURDAY);
    expect(await tickAt(at(SATURDAY, "12:45"))).toEqual([]); // 10:45 ST
    const sixty = await tickAt(at(SATURDAY, "13:00")); // 11:00 ST
    expect(sixty).toEqual([
      [
        "**KvK soon**",
        "",
        "KvK starts in 60 minutes, at 12:00 ST.",
        "",
        "Roles:",
        "Castle defence: Bo Example",
        "",
        "Good luck, everyone, and thank you!",
      ].join("\n"),
    ]);
    expect(sixty.join()).not.toMatch(/Cy Example|Meet at the gate/);
    expect(await tickAt(at(SATURDAY, "13:15"))).toEqual([]); // 11:15 ST
    const fifteen = await tickAt(at(SATURDAY, "13:45")); // 11:45 ST
    expect(fifteen).toHaveLength(1);
    expect(fifteen[0]).toContain("KvK starts in 15 minutes, at 12:00 ST.");
    expect(await tickAt(at(SATURDAY, "14:00"))).toEqual([]); // the start
    expect((await db.select().from(postRuns)).map((r) => [r.period, r.status]).sort()).toEqual([
      [`${SATURDAY} T-15`, "posted"],
      [`${SATURDAY} T-60`, "posted"],
    ]);
  });

  it("sends nothing while its switch is off or the owner does not allow it", async () => {
    await kvkOn(SATURDAY);
    expect(await tickAt(at(SATURDAY, "13:00"))).toEqual([]);
    await turnOn();
    await setSwitch(db, ws, "post_kvk_soon", false, at(SATURDAY, "00:00"));
    expect(await tickAt(at(SATURDAY, "13:00"))).toEqual([]);
    expect(await db.select().from(postRuns)).toEqual([]);
  });

  it("is not due on an Origin of Chaos Saturday (#806): nothing posted and nothing settled", async () => {
    await turnOn();
    await kvkOn("2026-12-05");
    expect(await tickAt(at("2026-12-05", "13:00"))).toEqual([]);
    expect(await db.select().from(postRuns)).toEqual([]);
  });

  it("tells officers on the card which KvK starts it can remind in full", async () => {
    const access = {
      workspaceId: ws,
      features: { on: new Set(["post_kvk_soon"]) },
    } as unknown as WorkspaceAccess;
    const channels = [
      { channel: "members", state: "set", name: "general", forum: false, savedAt: null },
    ] as const;
    const rows = await postsView(db, access, [...channels], testContext(db, ENV).ctx.env, "en");
    expect(rows).toMatchObject([
      { post: "kvk_soon", channel: "members", day: "Saturday", from: "11:00", to: "14:00" },
    ]);
  });
});
