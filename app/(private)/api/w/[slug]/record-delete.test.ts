// D123: the shared soft delete on the first batch of officer-owned records (Calendar entries, thefts, new
// members), through their own routes. Each one leaves every read, gets its own Home line, refuses a member
// (401) and another workspace (404), comes back with the deleter's Undo, and a replay after Undo deletes
// nothing. Invented names only.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { calendarDays } from "@/lib/private/calendar";
import { recentActivity } from "@/lib/private/desk-activity.test-helpers";
import { dismissedMembers, pendingMembers } from "@/lib/private/pending-members";
import { UNDO_MS } from "@/lib/private/roll-call";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { theftsView } from "@/lib/private/thefts";
import { dailyReads, dailyRosters, workspaces, workspaceUsers } from "@/lib/schema";
import { thefts } from "@/lib/schema-thefts";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const ROUTES = {
  calendar: await import("./calendar/route"),
  thefts: await import("./thefts/route"),
  pending: await import("./pending/route"),
  "roll-call": await import("./roll-call/route"),
};

const OGS = 67111155;
const WEEK = "2026-11-02";
let db: Db;
const tokens: Record<string, string> = {};
let clock: { now: Date };

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const context = testContext(db);
  holder.ctx = context.ctx;
  clock = context.clock;
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  const [other] = await db
    .insert(workspaces)
    .values({ unionId: 1, slug: "rivals", discordGuildId: "9", leaderRoleIds: ["8"] })
    .returning({ id: workspaces.id });
  await db.insert(dailyReads).values({ day: "2026-11-06", startedAt: T0, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-06",
    unionId: OGS,
    memberCount: 1,
    isFresh: true,
    sourceUpdatedAt: T0,
    memberUids: [101],
    memberNames: ["Bramble"],
    memberPower: [1000],
    memberKills: [0],
  });
  // Mo has a member's session (D105); Zed is an officer of another workspace.
  for (const [name, wsId, tier] of [
    ["Ana", ws?.id, "officer"],
    ["Bo", ws?.id, "officer"],
    ["Mo", ws?.id, "member"],
    ["Zed", other?.id, "officer"],
  ] as const) {
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId: wsId ?? 0, discordUserId: `ws-${name}`, displayName: name })
      .returning({ id: workspaceUsers.id });
    tokens[name] = (await createSession(db, wsId ?? 0, user?.id ?? 0, T0, null, tier)).token;
  }
});

type Route = keyof typeof ROUTES;
const post = async (route: Route, body: unknown, who = "Ana") => {
  const slug = who === "Zed" ? "rivals" : "ogs";
  const res = await ROUTES[route].POST(
    new Request(`https://laptracker.test/api/w/${slug}/${route}`, {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${tokens[who]}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug }) },
  );
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
};

const access = async (who = "Ana") => {
  const a = await requireWorkspace(db, "ogs", { get: () => ({ value: tokens[who] ?? "" }) }, T0);
  if (!a.ok) throw new Error("no access");
  return a;
};
/** Home's lines for Bo, by kind. */
const homeKinds = async () =>
  (await recentActivity(db, await access("Bo"), T0)).map((l) => l.item.kind);

/** The three record types: how to add one, delete it (or undo), and whether the desk still shows it. */
const TYPES = {
  calendar: {
    add: async () => {
      const entry = { kind: "other", title: "Test raid", day: "2026-11-07", minute: 720 };
      const made = await post("calendar", { action: "create", entry, requestId: randomUUID() });
      return made.json.id as number;
    },
    remove: (id: number, requestId: string, undo?: true) => ({
      action: "delete",
      entry: id,
      scope: "all",
      week: WEEK,
      requestId,
      ...(undo && { undo }),
    }),
    shown: async () => (await calendarDays(db, await access(), WEEK, "2026-11-08")).length,
  },
  thefts: {
    add: async () => {
      await post("thefts", {
        action: "add",
        attacker: { name: "Stene", tag: "1b8R" },
        victimUid: null,
        day: "2026-11-06",
        time: "20:00",
        kind: "ops",
        note: "",
        requestId: randomUUID(),
      });
      const rows = await db.select({ id: thefts.id }).from(thefts);
      return Math.max(...rows.map((r) => r.id));
    },
    remove: (id: number, requestId: string, undo?: true) => ({
      action: "remove",
      id,
      requestId,
      ...(undo && { undo }),
    }),
    shown: async () => {
      const view = await theftsView(db, await access(), { now: T0, zone: "Etc/GMT+2" });
      return view.groups.flatMap((g) => g.attackers).reduce((n, a) => n + a.total, 0);
    },
  },
  pending: {
    add: async () => {
      const body = { action: "add", requestId: randomUUID(), name: "Zephyrine", changes: [] };
      return (await post("pending", body)).json.uid as number;
    },
    remove: (uid: number, requestId: string, undo?: true) => ({
      action: "delete",
      uid,
      requestId,
      ...(undo && { undo }),
    }),
    shown: async () => (await pendingMembers(db, await access())).length,
  },
} satisfies Record<Exclude<Route, "roll-call">, unknown>;

describe.each(Object.keys(TYPES) as (keyof typeof TYPES)[])(
  "deleting a record: %s (D123)",
  (type) => {
    const t = TYPES[type];

    it("refuses a member (401) and another workspace's officer (404)", async () => {
      const id = await t.add();
      expect((await post(type, t.remove(id, randomUUID()), "Mo")).status).toBe(401);
      expect((await post(type, t.remove(id, randomUUID()), "Zed")).status).toBe(404);
      expect(await t.shown()).toBe(1);
    });

    it("Undo brings it back, for the officer who deleted, within UNDO_MS", async () => {
      const id = await t.add();
      const requestId = randomUUID();
      expect((await post(type, t.remove(id, requestId))).status).toBe(200);
      expect(await t.shown()).toBe(0);
      expect((await post(type, t.remove(id, requestId, true), "Bo")).status).toBe(404);
      expect((await post(type, t.remove(id, requestId, true))).status).toBe(200);
      expect(await t.shown()).toBe(1);
      const late = randomUUID();
      await post(type, t.remove(id, late));
      clock.now = new Date(T0.getTime() + UNDO_MS + 1);
      expect((await post(type, t.remove(id, late, true))).status).toBe(404);
      expect(await t.shown()).toBe(0);
    });

    it("a replay of a delete after its Undo deletes nothing", async () => {
      const id = await t.add();
      const requestId = randomUUID();
      await post(type, t.remove(id, requestId));
      await post(type, t.remove(id, requestId, true));
      expect((await post(type, t.remove(id, requestId))).status).toBe(200);
      expect(await t.shown()).toBe(1);
    });
  },
);

describe("a deleted record leaves every read, and Home says who deleted it (D123)", () => {
  it("a Calendar entry: off the Calendar, its edits refused, its lines gone; two deletes, two lines", async () => {
    const first = await TYPES.calendar.add();
    const second = await TYPES.calendar.add();
    await post("calendar", TYPES.calendar.remove(first, randomUUID()));
    await post("calendar", TYPES.calendar.remove(second, randomUUID()));
    expect(await TYPES.calendar.shown()).toBe(0);
    const change = { field: "notes", value: "x", version: 0 };
    const edit = { action: "edit", entry: first, week: null, changes: [change] };
    expect((await post("calendar", edit)).status).toBe(404);
    const kinds = await homeKinds();
    expect(kinds.filter((k) => k === "entryDeleted")).toHaveLength(2);
    expect(kinds).not.toContain("entry");
  });

  it("a deleted Elixir Scramble entry no longer holds its team's members", async () => {
    const team = async (variant: string) => {
      const entry = { kind: "elixir", variant, day: "2026-11-06", minute: 1080 };
      const made = await post("calendar", { action: "create", entry, requestId: randomUUID() });
      return made.json.id as number;
    };
    const [a, b] = [await team("A"), await team("B")];
    const pick = (entry: number) =>
      post("roll-call", { action: "team", occasion: { entry, week: WEEK }, uids: [101], on: true });
    expect((await pick(a)).status).toBe(200);
    expect((await pick(b)).status).toBe(409);
    await post("calendar", TYPES.calendar.remove(a, randomUUID()));
    expect((await pick(b)).status).toBe(200);
  });

  it("a deleted Alliance Duel theme frees its week; Undo is then refused", async () => {
    const theme = { kind: "duel", title: "Tech", day: WEEK };
    const made = await post("calendar", {
      action: "create",
      entry: theme,
      requestId: randomUUID(),
    });
    const requestId = randomUUID();
    await post("calendar", TYPES.calendar.remove(made.json.id as number, requestId));
    const again = { action: "create", entry: theme, requestId: randomUUID() };
    expect((await post("calendar", again, "Bo")).status).toBe(200);
    const undo = TYPES.calendar.remove(made.json.id as number, requestId, true);
    expect((await post("calendar", undo)).status).toBe(404);
  });

  it("a theft: off the log, its counts and follow-up; Home has the delete, not the add", async () => {
    const id = await TYPES.thefts.add();
    const [row] = await db.select({ key: thefts.attackerKey }).from(thefts);
    await post("thefts", TYPES.thefts.remove(id, randomUUID()));
    expect(await TYPES.thefts.shown()).toBe(0);
    const follow = {
      action: "follow",
      attacker: row?.key,
      state: "talked",
      note: "",
      requestId: randomUUID(),
      expected: null,
    };
    expect((await post("thefts", follow)).status).toBe(404);
    const kinds = await homeKinds();
    expect([kinds.includes("theftDeleted"), kinds.includes("thefts")]).toEqual([true, false]);
  });

  it("a theft's Undo is refused when the same theft was added again meanwhile", async () => {
    const id = await TYPES.thefts.add();
    const requestId = randomUUID();
    await post("thefts", TYPES.thefts.remove(id, requestId));
    await TYPES.thefts.add();
    expect((await post("thefts", TYPES.thefts.remove(id, requestId, true))).status).toBe(404);
    expect(await TYPES.thefts.shown()).toBe(1);
  });

  it("a new member: off the list, kept under Removed; Home has the delete, not the add", async () => {
    const uid = await TYPES.pending.add();
    await post("pending", TYPES.pending.remove(uid, randomUUID()));
    expect(await TYPES.pending.shown()).toBe(0);
    expect((await dismissedMembers(db, await access())).map((m) => m.uid)).toEqual([uid]);
    const kinds = await homeKinds();
    expect([kinds.includes("newMemberDeleted"), kinds.includes("newMember")]).toEqual([
      true,
      false,
    ]);
  });
});
