import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import {
  dailyReads,
  dailyRosters,
  memberFacts,
  pendingMembers,
  workspaces,
  workspaceUsers,
} from "@/lib/schema";
import { allianceDuelPoints } from "@/lib/schema-import";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");
const facts = await import("../members/[uid]/facts/route");

const OGS = 67111155;
const NSE = 67109944;
let db: Db;
const tokens: Record<string, string> = {};

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db).ctx;
  await db.insert(dailyReads).values({ day: "2026-11-06", startedAt: T0, status: "complete" });
  for (const [slug, unionId, uid] of [
    ["ogs", OGS, 101],
    ["nse", NSE, 201],
  ] as const) {
    const [ws] = await db
      .insert(workspaces)
      .values({ unionId, slug, discordGuildId: slug, leaderRoleIds: ["2"] })
      .returning({ id: workspaces.id });
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId: ws?.id ?? 0, discordUserId: `${slug}-ana`, displayName: "Ana" })
      .returning({ id: workspaceUsers.id });
    tokens[slug] = (await createSession(db, ws?.id ?? 0, user?.id ?? 0, T0, null, "officer")).token;
    await db.insert(dailyRosters).values({
      readDay: "2026-11-06",
      unionId,
      memberCount: 1,
      isFresh: true,
      sourceUpdatedAt: T0,
      memberUids: [uid],
      memberNames: ["Corvin"],
      memberPower: [1000],
      memberKills: [0],
    });
  }
});

const request = (url: string, body: unknown, opts: { slug?: string; type?: string }) =>
  new Request(url, {
    method: "POST",
    headers: {
      origin: "https://laptracker.test",
      "content-type": opts.type ?? "application/json",
      cookie: `${SESSION_COOKIE}=${tokens[opts.slug ?? "ogs"]}`,
    },
    body: JSON.stringify(body),
  });

const post = (body: unknown, opts: { slug?: string; type?: string } = {}) =>
  route.POST(request(`https://laptracker.test/api/w/${opts.slug ?? "ogs"}/pending`, body, opts), {
    params: Promise.resolve({ slug: opts.slug ?? "ogs" }),
  });

const answer = async (res: Response) => [res.status, await res.json()];

const add = (requestId: string, name = "Zephyrine") => ({
  action: "add",
  requestId,
  name,
  changes: [{ field: "troopTier", version: 0, value: 10, source: "officer" }],
});

/** A pending member of OGs with one fact and one Alliance Duel day; its uid. */
async function pendingOfOgs(name = "Zephyrine"): Promise<number> {
  const body = (await (await post(add(randomUUID(), name))).json()) as { uid: number };
  const [ws] = await db.select({ id: workspaces.id }).from(workspaces).limit(1);
  await db.insert(allianceDuelPoints).values({
    workspaceId: ws?.id ?? 0,
    uid: body.uid,
    week: "2026-11-02",
    day: "mon",
    points: 1000,
    savedAt: T0,
  });
  return body.uid;
}

describe("POST /api/w/[slug]/pending (D106)", () => {
  it("adds a new member with first facts; a repeat of the same request stores nothing new", async () => {
    const requestId = randomUUID();
    const first = await post(add(requestId));
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    const body = (await first.json()) as { uid: number; results: { status: string }[] };
    expect(body.uid).toBeLessThan(0);
    expect(body.results).toMatchObject([{ status: "saved", version: 1, value: 10 }]);

    const again = await post(add(requestId));
    expect(await again.json()).toEqual({ ok: true, uid: body.uid, results: [] });
    expect(await db.select().from(pendingMembers)).toHaveLength(1);
    expect(await db.select().from(memberFacts)).toHaveLength(1);
  });

  it("answers 403 for a form, 400 for no name or request id", async () => {
    expect((await post(add(randomUUID()), { type: "text/plain" })).status).toBe(403);
    expect((await post(add(randomUUID(), "  "))).status).toBe(400);
    expect((await post({ ...add(randomUUID()), requestId: "again" })).status).toBe(400);
    expect(await answer(await post(add(randomUUID(), "★★")))).toEqual([400, { code: "bad_name" }]);
    expect(await db.select().from(pendingMembers)).toEqual([]);
  });

  it("links to a member (200), refuses a non-member (400) and a pending member already gone (404)", async () => {
    const uid = await pendingOfOgs();
    expect(await answer(await post({ action: "link", uid, to: 999 }))).toEqual([
      400,
      { code: "not_member" },
    ]);
    expect(await answer(await post({ action: "link", uid, to: 101 }))).toEqual([200, { ok: true }]);
    expect(await answer(await post({ action: "link", uid, to: 101 }))).toEqual([
      404,
      { code: "not_found" },
    ]);
    const moved = await db.select({ uid: memberFacts.uid }).from(memberFacts);
    expect(moved).toEqual([{ uid: 101 }]);
  });

  it("deletes by dismissing (200): record, facts and points stay, then 404; re-adding reopens it", async () => {
    const uid = await pendingOfOgs();
    expect(await answer(await post({ action: "delete", uid, requestId: randomUUID() }))).toEqual([
      200,
      { ok: true },
    ]);
    const [kept] = await db.select().from(pendingMembers);
    expect(kept?.id).toBe(-uid);
    expect(kept?.deletedAt).not.toBeNull();
    expect((await db.select().from(memberFacts)).map((f) => [f.uid, f.field])).toEqual([
      [uid, "troopTier"],
    ]);
    expect(await db.select({ uid: allianceDuelPoints.uid }).from(allianceDuelPoints)).toEqual([
      { uid },
    ]);
    expect(await answer(await post({ action: "delete", uid, requestId: randomUUID() }))).toEqual([
      404,
      { code: "not_found" },
    ]);
    const again = (await (await post({ ...add(randomUUID()), changes: [] })).json()) as {
      uid: number;
    };
    expect(again.uid).toBe(uid);
    expect((await db.select().from(pendingMembers))[0]?.deletedAt).toBeNull();
  });

  it("refuses facts for a removed member until re-added; a replay after the reopen repeats it", async () => {
    const uid = await pendingOfOgs();
    await post({ action: "delete", uid, requestId: randomUUID() });
    const change = { changes: [{ field: "notes", version: 0, value: "hi", source: "officer" }] };
    const write = () =>
      facts.POST(request(`https://laptracker.test/api/w/ogs/members/${uid}/facts`, change, {}), {
        params: Promise.resolve({ slug: "ogs", uid: String(uid) }),
      });
    expect(await answer(await write())).toEqual([404, { code: "not_member" }]);

    const requestId = randomUUID();
    const reopened = await (await post({ ...add(requestId), changes: [] })).json();
    expect(reopened.uid).toBe(uid);
    expect((await write()).status).toBe(200);
    // D100: the same request again answers the reopened member and stores nothing.
    expect(await (await post({ ...add(requestId), changes: [] })).json()).toEqual({
      ok: true,
      uid,
      results: [],
    });
    expect(await db.select().from(pendingMembers)).toHaveLength(1);
  });

  it("does not reopen another workspace's removed member with the same name", async () => {
    const uid = await pendingOfOgs();
    await post({ action: "delete", uid, requestId: randomUUID() });
    const theirs = await (
      await post({ ...add(randomUUID()), changes: [] }, { slug: "nse" })
    ).json();
    expect(theirs.uid).not.toBe(uid);
    const rows = await db
      .select({ id: pendingMembers.id, deletedAt: pendingMembers.deletedAt })
      .from(pendingMembers);
    expect(rows.find((r) => r.id === -uid)?.deletedAt).not.toBeNull();
    expect(rows).toHaveLength(2);
  });

  it("refuses another workspace's pending member in link, delete and the facts route", async () => {
    const uid = await pendingOfOgs();
    expect((await post({ action: "link", uid, to: 201 }, { slug: "nse" })).status).toBe(404);
    expect(
      (await post({ action: "delete", uid, requestId: randomUUID() }, { slug: "nse" })).status,
    ).toBe(404);
    const change = { changes: [{ field: "notes", version: 0, value: "hi", source: "officer" }] };
    const write = (slug: string, target: number) =>
      facts.POST(
        request(`https://laptracker.test/api/w/${slug}/members/${target}/facts`, change, { slug }),
        { params: Promise.resolve({ slug, uid: String(target) }) },
      );
    expect(await answer(await write("nse", uid))).toEqual([404, { code: "not_member" }]);
    // Below a serial id's range: no one, not a database error.
    expect(await answer(await write("ogs", -9_999_999_999))).toEqual([404, { code: "not_member" }]);
    expect(await db.select().from(pendingMembers)).toHaveLength(1);
    expect((await db.select().from(memberFacts)).map((f) => f.field)).toEqual(["troopTier"]);
  });
});
