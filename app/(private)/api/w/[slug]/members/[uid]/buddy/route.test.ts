// POST /api/w/[slug]/members/[uid]/buddy (issue 828): an officer names a member's buddy and clears it; a
// member's session is refused with 401, another workspace's officer gets 404, and a buddy from another
// alliance is refused with 400. Invented names.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { dailyReads, dailyRosters, workspaceUsers } from "@/lib/schema";
import { SEED_AT, seedWorkspace } from "@/lib/workspace-data.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const ORIGIN = "https://laptracker.test";
const tokens = { officer: "", member: "", other: "" };
let db: Db;

async function roster(unionId: number, uids: number[]) {
  await db.insert(dailyRosters).values({
    readDay: "2026-11-17",
    unionId,
    memberCount: uids.length,
    sourceUpdatedAt: new Date("2026-11-17T12:00:00Z"),
    isFresh: true,
    memberUids: uids,
    memberNames: uids.map((u) => `Invented ${u}`),
    memberPower: uids.map(() => 1000),
    memberKills: uids.map(() => 10),
  });
}

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db, TEST_ENV).ctx;
  const nse = await seedWorkspace(db, "nse", 67109944);
  const ogs = await seedWorkspace(db, "ogs", 67111155);
  await db.insert(dailyReads).values({ day: "2026-11-17", startedAt: SEED_AT, status: "complete" });
  await roster(nse.unionId, [101, 102]);
  await roster(ogs.unionId, [201]);
  const [member] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: nse.workspaceId, discordUserId: "discord-member", displayName: "Mia" })
    .returning({ id: workspaceUsers.id });
  const session = (ws: number, user: number, tier: "officer" | "member") =>
    createSession(db, ws, user, SEED_AT, null, tier).then((s) => s.token);
  tokens.officer = await session(nse.workspaceId, nse.officer, "officer");
  tokens.member = await session(nse.workspaceId, member?.id ?? 0, "member");
  tokens.other = await session(ogs.workspaceId, ogs.officer, "officer");
});

const post = (slug: string, token: string, body: unknown) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/${slug}/members/101/buddy`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug, uid: "101" }) },
  );

const answer = async (res: Response) => [res.status, await res.json()];

describe("POST /api/w/[slug]/members/[uid]/buddy (issue 828)", () => {
  it("lets an officer name a buddy and clear it again, each a new version", async () => {
    expect(await answer(await post("nse", tokens.officer, { version: 0, buddy: 102 }))).toEqual([
      200,
      { status: "saved", version: 1, value: 102 },
    ]);
    expect(await answer(await post("nse", tokens.officer, { version: 1, buddy: null }))).toEqual([
      200,
      { status: "saved", version: 2, value: null },
    ]);
  });

  it("answers a stale version with 409 and the buddy another officer saved", async () => {
    await post("nse", tokens.officer, { version: 0, buddy: 102 });
    expect(await answer(await post("nse", tokens.officer, { version: 0, buddy: null }))).toEqual([
      409,
      { status: "conflict", version: 1, value: 102 },
    ]);
  });

  it("refuses a bad body with 400 and another origin with 403", async () => {
    for (const body of [
      { version: 0, buddy: 1.5 },
      { version: 0, buddy: 102, extra: true },
    ])
      expect(await answer(await post("nse", tokens.officer, body))).toEqual([
        400,
        { code: "bad_request" },
      ]);
    const elsewhere = new Request(`${ORIGIN}/api/w/nse/members/101/buddy`, {
      method: "POST",
      headers: {
        origin: "https://elsewhere.test",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${tokens.officer}`,
      },
      body: JSON.stringify({ version: 0, buddy: 102 }),
    });
    const res = await route.POST(elsewhere, {
      params: Promise.resolve({ slug: "nse", uid: "101" }),
    });
    expect(await answer(res)).toEqual([403, { code: "forbidden" }]);
  });

  it("refuses a member's session with 401 and another workspace's officer with 404", async () => {
    expect(await answer(await post("nse", tokens.member, { version: 0, buddy: 102 }))).toEqual([
      401,
      { code: "signed_out" },
    ]);
    expect(await answer(await post("ogs", tokens.other, { version: 0, buddy: 102 }))).toEqual([
      404,
      { code: "not_member" },
    ]);
  });

  it("refuses a buddy who is not in the alliance, or the member themselves, with 400", async () => {
    for (const buddy of [201, 101])
      expect(await answer(await post("nse", tokens.officer, { version: 0, buddy }))).toEqual([
        400,
        { code: "bad_request" },
      ]);
  });
});
