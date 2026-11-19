import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_PIN, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { workspaces, workspaceSessions, workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

let db: Db;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db).ctx;
});

const post = (pin: string, body: unknown) =>
  route.POST(
    new Request("https://laptracker.test/api/admin/workspaces/sign-out", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", "x-edit-pin": pin },
      body: JSON.stringify(body),
    }),
  );

/** Two workspaces, each with an officer and a member signed in; returns their ids and user ids. */
async function seed() {
  const ws: Record<string, { id: number; officer: number; member: number }> = {};
  for (const [unionId, slug] of [
    [1, "ogs"],
    [2, "nse"],
  ] as const) {
    const [w] = await db
      .insert(workspaces)
      .values({ unionId, slug, discordGuildId: String(unionId), leaderRoleIds: ["2"] })
      .returning({ id: workspaces.id });
    const id = w?.id ?? 0;
    const users: Record<string, number> = {};
    for (const tier of ["officer", "member"] as const) {
      const [user] = await db
        .insert(workspaceUsers)
        .values({ workspaceId: id, discordUserId: `${slug}-${tier}`, displayName: tier })
        .returning({ id: workspaceUsers.id });
      users[tier] = user?.id ?? 0;
      await db.insert(workspaceSessions).values({
        tokenHash: `${slug}-${tier}-hash`,
        workspaceId: id,
        workspaceUserId: user?.id ?? 0,
        createdAt: T0,
        expiresAt: new Date(T0.getTime() + 86_400_000),
        tier,
      });
    }
    ws[slug] = { id, officer: users.officer ?? 0, member: users.member ?? 0 };
  }
  return ws as Record<"ogs" | "nse", { id: number; officer: number; member: number }>;
}

const left = async () => (await db.select().from(workspaceSessions)).map((s) => s.tokenHash).sort();

describe("POST /api/admin/workspaces/sign-out (D105, amended 2026-11-17)", () => {
  it("refuses a wrong PIN and a body outside the schema", async () => {
    const { ogs } = await seed();
    expect((await post("wrong-pin", { workspace_id: ogs.id, scope: "all" })).status).toBe(401);
    expect((await post(TEST_PIN, { workspace_id: ogs.id })).status).toBe(400);
    expect((await post(TEST_PIN, { workspace_id: ogs.id, scope: "user" })).status).toBe(400);
    expect(
      (await post(TEST_PIN, { workspace_id: ogs.id, scope: "all", user_id: ogs.member })).status,
    ).toBe(400);
    expect(await left()).toHaveLength(4);
  });

  it("everyone: ends every session of that workspace only", async () => {
    const { ogs } = await seed();
    const res = await post(TEST_PIN, { workspace_id: ogs.id, scope: "all" });
    expect([res.status, await res.json()]).toEqual([200, { ended: 2 }]);
    expect(await left()).toEqual(["nse-member-hash", "nse-officer-hash"]);
  });

  it("officers only: members stay signed in", async () => {
    const { ogs } = await seed();
    const res = await post(TEST_PIN, { workspace_id: ogs.id, scope: "officers" });
    expect([res.status, await res.json()]).toEqual([200, { ended: 1 }]);
    expect(await left()).toEqual(["nse-member-hash", "nse-officer-hash", "ogs-member-hash"]);
  });

  it("members only: officers stay signed in", async () => {
    const { ogs } = await seed();
    const res = await post(TEST_PIN, { workspace_id: ogs.id, scope: "members" });
    expect([res.status, await res.json()]).toEqual([200, { ended: 1 }]);
    expect(await left()).toEqual(["nse-member-hash", "nse-officer-hash", "ogs-officer-hash"]);
  });

  it("one person: ends all of that person's sessions, without blocking them", async () => {
    const { ogs } = await seed();
    await db.insert(workspaceSessions).values({
      tokenHash: "ogs-officer-phone-hash",
      workspaceId: ogs.id,
      workspaceUserId: ogs.officer,
      createdAt: T0,
      expiresAt: new Date(T0.getTime() + 86_400_000),
      tier: "officer",
    });
    const res = await post(TEST_PIN, { workspace_id: ogs.id, scope: "user", user_id: ogs.officer });
    expect([res.status, await res.json()]).toEqual([200, { ended: 2 }]);
    expect(await left()).toEqual(["nse-member-hash", "nse-officer-hash", "ogs-member-hash"]);
    const users = await db.select().from(workspaceUsers);
    expect(users.every((u) => !u.blocked)).toBe(true);
  });

  it("one person: refuses another workspace's user and ends nothing", async () => {
    const { ogs, nse } = await seed();
    const res = await post(TEST_PIN, { workspace_id: ogs.id, scope: "user", user_id: nse.officer });
    expect([res.status, await res.json()]).toEqual([404, { code: "no_session" }]);
    expect(await left()).toHaveLength(4);
  });
});
