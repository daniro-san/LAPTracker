import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_PIN, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { workspaces } from "@/lib/schema";

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
    new Request("https://laptracker.test/api/admin/workspaces", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", "x-edit-pin": pin },
      body: JSON.stringify(body),
    }),
  );

const base = {
  union_id: 67111155,
  slug: "ogs",
  discord_guild_id: "400000000000000001",
  leader_role_ids: ["300000000000000001"],
};
const memberRoles = async () => (await db.select().from(workspaces)).map((w) => w.memberRoleIds);

describe("POST /api/admin/workspaces: member roles (D105, amended 2026-11-17)", () => {
  it("refuses a wrong PIN and a body outside the schema, and writes nothing", async () => {
    const roles = { ...base, member_role_ids: ["300000000000000009"] };
    expect((await post("wrong-pin", roles)).status).toBe(401);
    expect((await post(TEST_PIN, base)).status).toBe(400);
    expect((await post(TEST_PIN, { ...base, member_role_ids: ["members"] })).status).toBe(400);
    expect((await post(TEST_PIN, { ...roles, guest_role_ids: [] })).status).toBe(400);
    expect(await memberRoles()).toEqual([]);
  });

  it("saves the member roles once each, and an empty list turns the board off", async () => {
    const id = "300000000000000009";
    expect((await post(TEST_PIN, { ...base, member_role_ids: [id, id] })).status).toBe(200);
    expect(await memberRoles()).toEqual([[id]]);
    expect((await post(TEST_PIN, { ...base, member_role_ids: [] })).status).toBe(200);
    expect(await memberRoles()).toEqual([[]]);
  });
});

describe("POST /api/admin/workspaces: one workspace per Discord server (D126)", () => {
  it("refuses a second alliance on a server already taken, in words and in the database", async () => {
    expect((await post(TEST_PIN, { ...base, member_role_ids: [] })).status).toBe(200);
    const other = { ...base, union_id: 67109944, slug: "nse", member_role_ids: [] };
    const taken = await post(TEST_PIN, other);
    expect([taken.status, await taken.json()]).toEqual([409, { code: "guild_taken" }]);
    await expect(
      db.insert(workspaces).values({
        unionId: 67109944,
        slug: "nse",
        discordGuildId: base.discord_guild_id,
        leaderRoleIds: base.leader_role_ids,
      }),
    ).rejects.toThrow();
    expect((await db.select().from(workspaces)).map((w) => w.slug)).toEqual(["ogs"]);
  });
});
