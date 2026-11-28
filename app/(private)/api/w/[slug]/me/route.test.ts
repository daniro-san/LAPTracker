// A member's own page (D142), in the workspace isolation suite (issue 471): a linked member sees only their
// own data; changing the uid in a request reaches nobody else's; a link that waits for an officer shows
// nothing private; a member who left the alliance sees nothing more; another workspace's session claims
// nothing here. Invented workspaces, members and numbers only.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { meAccess, requireBoard } from "@/lib/private/access";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { meView } from "@/lib/private/me";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import {
  allianceSnapshots,
  dailyReads,
  dailyRosters,
  events,
  memberSnapshots,
  rollCallMarks,
  rollCalls,
  rollCallTeam,
  snapshots,
  workspaces,
  workspaceUsers,
} from "@/lib/schema";
import { heroCatalog, memberSquads } from "@/lib/schema-squads";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const ORIGIN = "https://laptracker.test";
const ALPHA = 900_001;
const BRAVO = 900_002;
const t = WORKSPACE_DICTIONARIES.en;
const at = { now: T0, zone: "Etc/GMT+2", endRead: "16:15", language: "en" as const, t };

let db: Db;
const tokens: Record<string, string> = {};
const users: Record<string, number> = {};

/** One alliance's usable daily roster, with each member's daily fields in raw_json (D127). */
async function roster(unionId: number, day: string, people: [number, string, number, number][]) {
  await db
    .insert(dailyReads)
    .values({ day, startedAt: T0, status: "complete" })
    .onConflictDoNothing();
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    memberCount: people.length,
    isFresh: true,
    memberUids: people.map((p) => p[0]),
    memberNames: people.map((p) => p[1]),
    memberPower: people.map((p) => p[2]),
    memberKills: people.map(() => 5),
    rawJson: {
      members: people.map(([uid, , , active]) => ({
        uid,
        active,
        daily_honor: active,
        daily_tech: active,
        // Blocked even for the member themself (CLAUDE.md, D71, D142): invented markers to look for.
        x: 4321,
        y: 8765,
        online: true,
        last_online_at: 1_777_000_001,
        joined_at: 1_666_000_002,
        avatar_url: "https://avatar.invalid/ana.png",
      })),
    },
  });
}

async function session(slug: string, wsId: number, name: string, tier: "member" | "officer") {
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: wsId, discordUserId: `d-${slug}-${name}`, displayName: name })
    .returning({ id: workspaceUsers.id });
  users[`${slug}:${name}`] = user?.id ?? 0;
  tokens[`${slug}:${name}`] = (await createSession(db, wsId, user?.id ?? 0, T0, null, tier)).token;
}

const ALPHA_PEOPLE = (ana: number, bo: number): [number, string, number, number][] => [
  [101, "Ana Invented", ana, 501],
  [102, "Bo Invented", bo, 909],
];

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db).ctx;
  const [alpha, bravo] = await db
    .insert(workspaces)
    .values([
      {
        unionId: ALPHA,
        slug: "alpha",
        discordGuildId: "1",
        leaderRoleIds: ["2"],
        memberRoleIds: ["5"],
      },
      {
        unionId: BRAVO,
        slug: "bravo",
        discordGuildId: "3",
        leaderRoleIds: ["4"],
        memberRoleIds: ["6"],
      },
    ])
    .returning({ id: workspaces.id });
  const [a, b] = [alpha?.id ?? 0, bravo?.id ?? 0];
  // Last week, then this game week (T0 is Saturday 2026-11-07, server time).
  await roster(ALPHA, "2026-10-28", ALPHA_PEOPLE(900, 7000));
  await roster(ALPHA, "2026-11-02", ALPHA_PEOPLE(1000, 7700));
  await roster(ALPHA, "2026-11-06", ALPHA_PEOPLE(1100, 7777));
  await roster(BRAVO, "2026-11-06", [[202, "Cy Invented", 3000, 303]]);
  await db.insert(memberSquads).values(
    [101, 102].map((uid) => ({
      unionId: ALPHA,
      uid,
      squad: 1,
      power: uid === 101 ? 4444 : 8888,
      heroes: [],
      readAt: T0,
    })),
  );
  // Bo is on Team A of this week's Elixir Scramble.
  const [call] = await db
    .insert(rollCalls)
    .values({ workspaceId: a, kind: "elixir", variant: "A", day: "2026-11-07", week: "2026-11-02" })
    .returning({ id: rollCalls.id });
  await db
    .insert(rollCallTeam)
    .values({ rollCallId: call?.id ?? 0, uid: 102, name: "Bo", addedAt: T0 });
  await session("alpha", a, "Ana Invented", "member");
  await session("alpha", a, "Bobby", "member");
  await session("alpha", a, "Rook", "officer");
  await session("bravo", b, "Cy Invented", "member");
  await session("bravo", b, "Vale Officer", "officer");
});

async function post(path: "me" | "member-links", who: string, body: object, slug = "alpha") {
  const mod = path === "me" ? await import("./route") : await import("../member-links/route");
  const headers = new Headers({
    origin: ORIGIN,
    "sec-fetch-site": "same-origin",
    "content-type": "application/json",
    cookie: `${SESSION_COOKIE}=${tokens[who]}`,
  });
  const request = new Request(`${ORIGIN}/api/w/${slug}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const res = await mod.POST(request, { params: Promise.resolve({ slug }) });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** What the page shows the session at `now`: its own data, or null when nothing private may be shown. */
async function shown(who: string, now = T0) {
  const board = await requireBoard(db, "alpha", { get: () => ({ value: tokens[who] ?? "" }) }, T0);
  if (!board.ok) throw new Error(board.reason);
  const me = meAccess(board);
  return me && meView(db, me, { ...at, now });
}

/** A member claims `uid`; an officer approves it (D142: every member's link waits for an officer). */
async function linked(who: string, uid: number) {
  await post("me", who, { action: "claim", uid });
  await post("member-links", "alpha:Rook", { action: "approve", user: users[who], uid });
}

/** A public scheduled event (Sat, Oct 31 unless `at`) with the alliance's reads: window, phase, between
 * windows, kills. */
async function kvk(
  reads: [number, "before" | "after", boolean, Record<number, number>][],
  at = new Date("2026-10-31T14:00:00Z"),
) {
  const [event] = await db
    .insert(events)
    .values({
      name: "Saturday Event 2026-10-31",
      eventAtUtc: at,
      allianceIds: [ALPHA],
      beforeAt: at,
      afterAt: at,
    })
    .returning({ id: events.id });
  for (const [windowN, phase, betweenWindows, kills] of reads) {
    const [snap] = await db
      .insert(snapshots)
      .values({
        eventId: event?.id ?? 0,
        phase,
        windowN,
        betweenWindows,
        startedAt: at,
        status: "complete",
      })
      .returning({ id: snapshots.id });
    const [row] = await db
      .insert(allianceSnapshots)
      .values({ snapshotId: snap?.id ?? 0, unionId: ALPHA, source: "v1", isFresh: true })
      .returning({ id: allianceSnapshots.id });
    await db.insert(memberSnapshots).values(
      Object.entries(kills).map(([uid, k]) => ({
        allianceSnapshotId: row?.id ?? 0,
        uid: Number(uid),
        name: "Invented",
        lv: 20,
        power: 1000,
        kills: k,
      })),
    );
  }
}

describe("a member's own page (D142, issue 471)", () => {
  it("waits for an officer even on a name match, then shows only that member's data", async () => {
    // "Ana Invented" is the game name, and still the link waits: a nickname proves nothing.
    expect(await post("me", "alpha:Ana Invented", { action: "claim", uid: 101 })).toEqual({
      status: 200,
      body: { state: "pending" },
    });
    expect(await shown("alpha:Ana Invented")).toBeNull();
    const ana = { action: "approve", user: users["alpha:Ana Invented"], uid: 101 };
    // A member cannot approve their own link: the officers' route answers a member's session as signed out.
    expect((await post("member-links", "alpha:Ana Invented", ana)).status).toBe(401);
    expect((await post("member-links", "alpha:Rook", ana)).status).toBe(200);
    const view = await shown("alpha:Ana Invented");
    const text = JSON.stringify(view);
    expect(view).toMatchObject({ left: false, name: "Ana Invented", needed: [] });
    expect(text).toContain("Ana Invented");
    // Nobody else's name, numbers, squads or team.
    for (const other of ["Bo Invented", "909", "8,888", "8.89K", "Team A", "Cy Invented"])
      expect(text).not.toContain(other);
    // Still blocked for the member themself: map position, online, join date and photo address.
    for (const blocked of ["4321", "8765", "1777000001", "1666000002", "avatar.invalid"])
      expect(text).not.toContain(blocked);
    expect(text).not.toMatch(/"x"|"y"|online|joined|avatar/i);
  });

  it("shows the member's own daily fields for their own approved link only (owner, 2026-11-21)", async () => {
    const values = async (who: string) => {
      const view = await shown(who);
      if (!view || view.left || !view.week) return null;
      return view.week.rows.map((r) => [r.metric, r.bars.slice(0, 5).map((b) => b.value)]);
    };
    // Pending: nothing, not even the member's own week.
    await post("me", "alpha:Ana Invented", { action: "claim", uid: 101 });
    expect(await values("alpha:Ana Invented")).toBeNull();
    const ana = { user: users["alpha:Ana Invented"], uid: 101 };
    await post("member-links", "alpha:Rook", { action: "approve", ...ana });
    // Monday to Friday of this game week: 501 on Monday and Friday, no reading in between. Quest points
    // are the week's running total (#739): Monday's are 501, Friday's not known without Thursday's read.
    const own = ["501", "—", "—", "—", "501"];
    expect(await values("alpha:Ana Invented")).toEqual([
      ["quests", ["501", "—", "—", "—", "—"]],
      ["coins", own],
      ["donations", own],
    ]);

    // Bobby, linked to the other player, sees that player's 909 and never Ana's 501.
    await linked("alpha:Bobby", 102);
    const bobby = JSON.stringify(await shown("alpha:Bobby"));
    expect(bobby).toContain("909");
    expect(bobby).not.toContain("501");
    // Removed: the page and its week close again.
    await post("member-links", "alpha:Rook", { action: "unlink", ...ana });
    expect(await values("alpha:Ana Invented")).toBeNull();
  });

  it("gives a member's Raid prep ✗ its next step until KvK, then only the record, Ended after the End read (issue 585)", async () => {
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.slug, "alpha"));
    // Added by hand on KvK Saturday, with no time; the tracker's morning check marked Ana "No shield".
    const [call] = await db
      .insert(rollCalls)
      .values({ workspaceId: ws?.id ?? 0, kind: "shield", day: "2026-11-07", week: "2026-11-02" })
      .returning({ id: rollCalls.id });
    const mark = { uid: 101, version: 1, mark: "no", writtenAt: T0, byTracker: true };
    await db.insert(rollCallMarks).values({ rollCallId: call?.id ?? 0, ...mark });
    await linked("alpha:Ana Invented", 101);
    const line = "Raid prep, Sat, Nov 7 · your mark: “No shield”";
    // KvK at 12:00 ST and its End read at 16:15 ST, Saturday 2026-11-07.
    const when = {
      at: Date.parse("2026-11-07T14:00:00Z"),
      end: Date.parse("2026-11-07T18:15:00Z"),
    };
    // T0 is Sat 10:00 ST: after the reset, before KvK.
    expect(await shown("alpha:Ana Invented")).toMatchObject({
      needed: [
        { line, when, step: "Next step: turn on your shield before KvK starts at 12:00 ST." },
      ],
    });
    const evening = await shown("alpha:Ana Invented", new Date("2026-11-07T19:00:00Z")); // 17:00 ST
    expect(evening).toMatchObject({ needed: [{ line, when, step: undefined }] });
  });

  it("never lets a false claim lock the real player out, or an answer reach a later claim", async () => {
    // Bobby claims Ana's player first: it waits, and reserves nothing; Ana can still claim it.
    await post("me", "alpha:Bobby", { action: "claim", uid: 101 });
    expect(await post("me", "alpha:Ana Invented", { action: "claim", uid: 101 })).toMatchObject({
      status: 200,
      body: { state: "pending" },
    });
    // The officer approves Ana: Bobby's claim goes, so a late Approve of it finds nothing.
    await post("member-links", "alpha:Rook", {
      action: "approve",
      user: users["alpha:Ana Invented"],
      uid: 101,
    });
    const late = { action: "approve", user: users["alpha:Bobby"], uid: 101 };
    expect((await post("member-links", "alpha:Rook", late)).status).toBe(404);
    expect(await shown("alpha:Bobby")).toBeNull();
    expect(await shown("alpha:Ana Invented")).toMatchObject({ name: "Ana Invented" });
  });

  it("reaches nobody else's data by changing the uid in a request", async () => {
    await linked("alpha:Ana Invented", 101);
    // One approved link per player: Ana's is taken; one player per user: Ana must drop hers first.
    expect(await post("me", "alpha:Bobby", { action: "claim", uid: 101 })).toMatchObject({
      status: 409,
      body: { code: "taken" },
    });
    expect(await post("me", "alpha:Ana Invented", { action: "claim", uid: 102 })).toMatchObject({
      status: 409,
      body: { code: "linked" },
    });
    // Another alliance's player is not in this roster.
    expect(await post("me", "alpha:Bobby", { action: "claim", uid: 202 })).toMatchObject({
      status: 400,
      body: { code: "not_in_alliance" },
    });
    // Another workspace's member session claims nothing here.
    expect((await post("me", "bravo:Cy Invented", { action: "claim", uid: 102 })).status).toBe(401);
    expect(await shown("alpha:Bobby")).toBeNull();
  });

  it("closes the page of a member the newest roster no longer lists", async () => {
    await linked("alpha:Ana Invented", 101);
    await roster(ALPHA, "2026-11-07", [[102, "Bo Invented", 7800, 10]]);
    expect(await shown("alpha:Ana Invented")).toEqual({ left: true, name: "Ana Invented" });
  });

  it("lets an officer remove a link, which closes the page", async () => {
    await linked("alpha:Ana Invented", 101);
    const ana = { action: "unlink", user: users["alpha:Ana Invented"], uid: 101 };
    expect((await post("member-links", "alpha:Rook", ana)).status).toBe(200);
    expect(await shown("alpha:Ana Invented")).toBeNull();
    // A second Remove finds no link.
    expect((await post("member-links", "alpha:Rook", ana)).status).toBe(404);
  });

  it("binds an Approve to the claim the officer saw", async () => {
    await post("me", "alpha:Bobby", { action: "claim", uid: 102 });
    // Bobby drops it and claims another player before the officer answers.
    await post("me", "alpha:Bobby", { action: "drop" });
    await post("me", "alpha:Bobby", { action: "claim", uid: 101 });
    const stale = { action: "approve", user: users["alpha:Bobby"], uid: 102 };
    expect((await post("member-links", "alpha:Rook", stale)).status).toBe(404);
    expect((await post("member-links", "alpha:Rook", { ...stale, action: "unlink" })).status).toBe(
      404,
    );
    expect(await shown("alpha:Bobby")).toBeNull();
  });

  it("thanks a member for their own kills gained in the last KvK, as the sum of its windows (issue 793)", async () => {
    // A two-window event on Sat, Oct 31: Ana gains 200K in window 1 and 500K in window 2; the 300K between
    // the windows is not the event's (D160). Bo gains 3M.
    await kvk([
      [1, "before", false, { 101: 1_000_000, 102: 9_000_000 }],
      [1, "after", true, { 101: 1_200_000, 102: 10_000_000 }],
      [2, "before", true, { 101: 1_500_000, 102: 10_000_000 }],
      [2, "after", false, { 101: 2_000_000, 102: 12_000_000 }],
    ]);
    // A pending link shows nothing personal, the thanks included.
    await post("me", "alpha:Ana Invented", { action: "claim", uid: 101 });
    expect(await shown("alpha:Ana Invented")).toBeNull();
    await post("member-links", "alpha:Rook", {
      action: "approve",
      user: users["alpha:Ana Invented"],
      uid: 101,
    });
    const view = await shown("alpha:Ana Invented");
    expect(view).toMatchObject({
      progress: { thanks: "Thanks for the 700K kills you gained in KvK (Sat, Oct 31)." },
    });
    // Never another member's: Bo's 3M gain is nowhere on Ana's page.
    expect(JSON.stringify(view)).not.toMatch(/3M|3\.00M|12M/);
  });

  it("shows no thanks line when no KvK was read in the last 30 days", async () => {
    // Sat, Oct 3 is 35 days before T0: older than the 30 days the page covers.
    await kvk(
      [
        [1, "before", false, { 101: 1_000_000 }],
        [1, "after", false, { 101: 2_000_000 }],
      ],
      new Date("2026-10-03T14:00:00Z"),
    );
    await linked("alpha:Ana Invented", 101);
    expect(await shown("alpha:Ana Invented")).toMatchObject({ progress: { thanks: null } });
  });

  it("shows the member's own squads with the heroes' names from the catalog, never another's", async () => {
    await db.insert(heroCatalog).values([
      { id: 10005, name: "Kesso Invented", updatedAt: T0 },
      { id: 10006, name: "Bo’s Hero Invented", updatedAt: T0 },
    ]);
    await db.insert(memberSquads).values(
      [
        [101, 10005],
        [102, 10006],
      ].map(([uid, id]) => ({
        unionId: ALPHA,
        uid: uid ?? 0,
        squad: 2,
        power: 5555,
        heroes: [{ id: id ?? 0, lv: 80, star: 22, q: 5, awaken: 0 }],
        readAt: T0,
      })),
    );
    await linked("alpha:Ana Invented", 101);
    const text = JSON.stringify(await shown("alpha:Ana Invented"));
    expect(text).toContain("Kesso Invented");
    expect(text).not.toContain("Bo’s Hero Invented");
  });

  it("lets no officer of another workspace approve or remove a user here by id", async () => {
    await post("me", "alpha:Bobby", { action: "claim", uid: 102 });
    const bobby = { user: users["alpha:Bobby"], uid: 102 };
    for (const action of ["approve", "unlink"])
      expect(
        (await post("member-links", "bravo:Vale Officer", { action, ...bobby }, "bravo")).status,
      ).toBe(404);
    // Bobby's claim is still there, waiting for this workspace's officer.
    expect((await post("member-links", "alpha:Rook", { action: "approve", ...bobby })).status).toBe(
      200,
    );
  });
});
