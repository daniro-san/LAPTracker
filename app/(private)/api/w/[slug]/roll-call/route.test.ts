import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { createEntry } from "@/lib/private/calendar";
import type { NewEntry } from "@/lib/private/calendar-model";
import { recentActivity } from "@/lib/private/desk-activity.test-helpers";
import { UNDO_MS } from "@/lib/private/roll-call";
import { archivedItems, callView, weekItems } from "@/lib/private/roll-call-view";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { dailyReads, dailyRosters, workspaces, workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const OGS = 67111155;
const URL_ = "https://laptracker.test/api/w/ogs/roll-call";
const WEEK = "2026-11-02";

let db: Db;
const tokens: Record<string, string> = {};
let kvk = 0;
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
  await db.insert(dailyReads).values({ day: "2026-11-06", startedAt: T0, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-06",
    unionId: OGS,
    memberCount: 2,
    isFresh: true,
    sourceUpdatedAt: T0,
    memberUids: [101, 102],
    memberNames: ["P101", "P102"],
    memberPower: [1000, 1000],
    memberKills: [0, 0],
  });
  // Mo has a member's session (D105); Zed is an officer of another workspace.
  const [other] = await db
    .insert(workspaces)
    .values({ unionId: 1, slug: "rivals", discordGuildId: "9", leaderRoleIds: ["8"] })
    .returning({ id: workspaces.id });
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
  const access = await requireWorkspace(
    db,
    "ogs",
    { get: () => ({ value: tokens.Ana ?? "" }) },
    T0,
  );
  if (!access.ok) throw new Error("no access");
  const entry = { kind: "kvk", day: "2026-11-07", minute: 720, notes: null, link: null };
  const made = await createEntry(
    db,
    access,
    { ...entry, forMembers: false, notice: null, weekly: false } as NewEntry,
    randomUUID(),
  );
  if (!made.ok) throw new Error(made.code);
  kvk = made.id;
});

const post = (
  body: unknown,
  opts: { who?: string; origin?: string; type?: string; slug?: string } = {},
) =>
  route.POST(
    new Request(URL_, {
      method: "POST",
      headers: {
        origin: opts.origin ?? "https://laptracker.test",
        "content-type": opts.type ?? "application/json",
        ...(opts.who && { cookie: `${SESSION_COOKIE}=${tokens[opts.who]}` }),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: opts.slug ?? "ogs" }) },
  );

const mark = (uid: number, m: "yes" | "no", version: number) => ({
  action: "mark",
  occasion: { entry: kvk, week: WEEK },
  uid,
  mark: m,
  version,
});

/** A hand add of `kind` (the add sheet's body). */
const add = (kind: string) => ({ action: "add", kind, day: "2026-11-18", requestId: randomUUID() });

describe("POST /api/w/[slug]/roll-call (issue 298)", () => {
  it("refuses a form from elsewhere (403) and a request without a session (401)", async () => {
    expect((await post(mark(101, "yes", 0), { who: "Ana", type: "text/plain" })).status).toBe(403);
    const cross = await post(mark(101, "yes", 0), { who: "Ana", origin: "https://evil.test" });
    expect([cross.status, await cross.json()]).toEqual([403, { code: "forbidden" }]);
    const out = await post(mark(101, "yes", 0));
    expect([out.status, await out.json()]).toEqual([401, { code: "signed_out" }]);
  });

  it("answers 400 for a bad body or a non-member, 404 for an occasion of no workspace", async () => {
    const badDay = await post(
      { ...mark(101, "yes", 0), occasion: { entry: kvk, week: "2026-02-31" } },
      { who: "Ana" },
    );
    expect([badDay.status, await badDay.json()]).toEqual([400, { code: "bad_request" }]);
    const nobody = await post(mark(999, "yes", 0), { who: "Ana" });
    expect([nobody.status, await nobody.json()]).toEqual([400, { code: "not_member" }]);
    const gone = await post({ ...mark(101, "yes", 0), occasion: { id: 4242 } }, { who: "Ana" });
    expect([gone.status, await gone.json()]).toEqual([404, { code: "not_found" }]);
  });

  it("answers a stale mark with 409, the newer mark, its version and who set it", async () => {
    const first = await post(mark(101, "no", 0), { who: "Ana" });
    expect(await first.json()).toEqual({ ok: true, version: 1 });
    const stale = await post(mark(101, "yes", 0), { who: "Bo" });
    expect(stale.status).toBe(409);
    expect(stale.headers.get("cache-control")).toBe("private, no-store");
    const body = (await stale.json()) as {
      code: string;
      mark: string;
      version: number;
      said: string;
    };
    expect([body.code, body.mark, body.version]).toEqual(["stale", "no", 1]);
    expect(body.said).toMatch(/Ana.* marked “No shield” just now/);
  });

  it("adds a Cheese Trap by hand", async () => {
    const cheese = await post(add("cheese"), { who: "Ana" });
    expect([cheese.status, await cheese.json()]).toMatchObject([
      200,
      { ok: true, id: expect.any(Number) },
    ]);
  });

  it("refuses a new plunder (2026-11-17)", async () => {
    const plunder = await post(add("plunder"), { who: "Ana" });
    expect([plunder.status, await plunder.json()]).toEqual([400, { code: "bad_request" }]);
  });
});

describe("deleting and archiving a roll call (issue 424, D120)", () => {
  const access = async (who = "Ana") => {
    const a = await requireWorkspace(db, "ogs", { get: () => ({ value: tokens[who] ?? "" }) }, T0);
    if (!a.ok) throw new Error("no access");
    return a;
  };
  const zone = () => holder.ctx?.env.SERVER_TZ ?? "UTC";
  const week = async () => weekItems(db, await access(), WEEK, zone());
  /** The KvK roll call, made by Ana's mark of 101: its id. */
  const marked = async () => {
    expect((await post(mark(101, "yes", 0), { who: "Ana" })).status).toBe(200);
    return (await week())[0]?.callId ?? 0;
  };
  const remove = (id: number, requestId: string, undo?: true) => ({
    action: "delete",
    id,
    requestId,
    ...(undo && { undo }),
  });

  it("deletes: the roll call leaves the week, its page, its marks and Home; the Calendar week starts again", async () => {
    const id = await marked();
    const done = await post(remove(id, randomUUID()), { who: "Ana" });
    expect([done.status, await done.json()]).toEqual([200, { ok: true }]);
    const [item] = await week();
    expect([item?.callId, item?.tally.yes]).toEqual([null, 0]);
    expect(await callView(db, await access(), { id }, "en", zone())).toBeNull();
    const again = await post({ ...mark(101, "no", 1), occasion: { id } }, { who: "Ana" });
    expect([again.status, await again.json()]).toEqual([404, { code: "not_found" }]);
    // A second KvK shield deleted right after is its own line: deletes never group (D108).
    const shield = { action: "add", kind: "shield", day: "2026-11-04", requestId: randomUUID() };
    const { id: other } = (await (await post(shield, { who: "Ana" })).json()) as { id: number };
    await post(remove(other, randomUUID()), { who: "Ana" });
    const kinds = (await recentActivity(db, await access("Bo"), T0)).map((l) => l.item.kind);
    expect(kinds.filter((k) => k === "callDeleted")).toHaveLength(2);
    expect(kinds).not.toContain("marks");
    // The Calendar's KvK week is a new, empty roll call: its first mark is version 1 again.
    expect(await (await post(mark(101, "no", 0), { who: "Bo" })).json()).toEqual({
      ok: true,
      version: 1,
    });
  });

  it("refuses a member's delete (401) and another workspace's (404)", async () => {
    const id = await marked();
    const member = await post(remove(id, randomUUID()), { who: "Mo" });
    expect([member.status, await member.json()]).toEqual([401, { code: "signed_out" }]);
    const rival = await post(remove(id, randomUUID()), { who: "Zed", slug: "rivals" });
    expect([rival.status, await rival.json()]).toEqual([404, { code: "not_found" }]);
    expect((await week())[0]?.callId).toBe(id);
  });

  it("Undo brings it back with its marks, for the officer who deleted, within UNDO_MS", async () => {
    const id = await marked();
    const requestId = randomUUID();
    await post(remove(id, requestId), { who: "Ana" });
    expect((await post(remove(id, requestId, true), { who: "Bo" })).status).toBe(404);
    expect((await post(remove(id, requestId, true), { who: "Ana" })).status).toBe(200);
    expect((await week())[0]?.tally.yes).toBe(1);
    const late = randomUUID();
    await post(remove(id, late), { who: "Ana" });
    clock.now = new Date(T0.getTime() + UNDO_MS + 1);
    expect((await post(remove(id, late, true), { who: "Ana" })).status).toBe(404);
  });

  it("a replay of a delete after its Undo deletes nothing", async () => {
    const id = await marked();
    const requestId = randomUUID();
    await post(remove(id, requestId), { who: "Ana" });
    await post(remove(id, requestId, true), { who: "Ana" });
    const replay = await post(remove(id, requestId), { who: "Ana" });
    expect(replay.status).toBe(200);
    expect((await week())[0]?.callId).toBe(id);
  });

  it("archives off the week's list into Archived, and unarchives it back", async () => {
    const body = { action: "add", kind: "cheese", day: "2026-11-04", requestId: randomUUID() };
    const { id } = (await (await post(body, { who: "Ana" })).json()) as { id: number };
    const archive = (on: boolean) => post({ action: "archive", id, on }, { who: "Bo" });
    expect((await archive(true)).status).toBe(200);
    expect((await archive(true)).status).toBe(200);
    expect((await week()).map((i) => i.callId)).toEqual([null]);
    expect((await archivedItems(db, await access(), zone())).map((i) => i.callId)).toEqual([id]);
    const kinds = (await recentActivity(db, await access(), T0)).map((l) => l.item.kind);
    expect(kinds).toContain("callArchived");
    expect((await archive(false)).status).toBe(200);
    expect((await week()).map((i) => i.callId)).toEqual([id, null]);
    expect(await archivedItems(db, await access(), zone())).toEqual([]);
  });
});
