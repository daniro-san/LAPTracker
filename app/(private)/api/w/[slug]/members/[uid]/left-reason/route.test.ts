// POST /api/w/[slug]/members/[uid]/left-reason (issue 469): an officer saves why a former member left; a
// member's session is refused with 401, and another workspace's officer gets 404 for this alliance's
// former member. Invented names.
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

async function roster(day: string, unionId: number, uids: number[]) {
  await db.insert(dailyRosters).values({
    readDay: day,
    unionId,
    memberCount: uids.length,
    sourceUpdatedAt: new Date(`${day}T12:00:00Z`),
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
  await db.insert(dailyReads).values([
    { day: "2026-11-10", startedAt: SEED_AT, status: "complete" },
    { day: "2026-11-17", startedAt: SEED_AT, status: "complete" },
  ]);
  // 102 left nse; ogs has its own newest roster.
  await roster("2026-11-10", nse.unionId, [101, 102]);
  await roster("2026-11-17", nse.unionId, [101]);
  await roster("2026-11-17", ogs.unionId, [201]);
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
    new Request(`${ORIGIN}/api/w/${slug}/members/102/left-reason`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug, uid: "102" }) },
  );

const answer = async (res: Response) => [res.status, await res.json()];
const REASON = { version: 0, reason: "removed", note: "  asked to leave after the season  " };

describe("POST /api/w/[slug]/members/[uid]/left-reason (issue 469)", () => {
  it("saves the officer's reason and note as the fact's first version", async () => {
    expect(await answer(await post("nse", tokens.officer, REASON))).toEqual([
      200,
      {
        status: "saved",
        version: 1,
        value: { reason: "removed", note: "asked to leave after the season" },
      },
    ]);
  });

  it("refuses a member with 401 and another workspace's officer with 404", async () => {
    expect(await answer(await post("nse", tokens.member, REASON))).toEqual([
      401,
      { code: "signed_out" },
    ]);
    expect(await answer(await post("ogs", tokens.other, REASON))).toEqual([
      404,
      { code: "not_former" },
    ]);
  });
});
