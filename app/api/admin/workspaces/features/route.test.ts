// POST /api/admin/workspaces/features (D126): every change needs the /admin PIN; "Copy settings from" gives the
// target the source's switches and caps as served (its defaults when it never had a row).
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_PIN, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { settingsById } from "@/lib/repo/workspace-features";
import { saveWorkspace } from "@/lib/repo/workspaces";
import { workspaceFeatures } from "@/lib/schema-features";

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
  // Invented alliances: 1 is OGs' workspace, 2 and 3 are new ones.
  await saveWorkspace(db, {
    unionId: 67111155,
    slug: "ogs",
    discordGuildId: "1",
    leaderRoleIds: ["9"],
  });
  await saveWorkspace(db, {
    unionId: 67109944,
    slug: "nse",
    discordGuildId: "2",
    leaderRoleIds: ["9"],
  });
  await saveWorkspace(db, {
    unionId: 67110000,
    slug: "abc",
    discordGuildId: "3",
    leaderRoleIds: ["9"],
  });
});

const post = (pin: string, body: unknown) =>
  route.POST(
    new Request("https://laptracker.test/api/admin/workspaces/features", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", "x-edit-pin": pin },
      body: JSON.stringify(body),
    }),
  );
const settingsOf = async (id: number) => (await settingsById(db, id))?.settings;

describe("POST /api/admin/workspaces/features (D126)", () => {
  it("changes nothing without the PIN", async () => {
    const turnOn = { action: "switch", workspace_id: 2, feature: "notice_translate", on: true };
    for (const pin of ["", "wrong-pin"]) {
      expect((await post(pin, turnOn)).status).toBe(401);
      expect((await post(pin, { action: "pause", allowance: "ai", paused: true })).status).toBe(
        401,
      );
    }
    expect(await db.select().from(workspaceFeatures)).toEqual([]);
    expect((await post(TEST_PIN, turnOn)).status).toBe(200);
    expect((await settingsOf(2))?.off).not.toContain("notice_translate");
  });

  it("copies another workspace's switches and caps, its defaults included", async () => {
    await post(TEST_PIN, { action: "switch", workspace_id: 2, feature: "thefts", on: false });
    await post(TEST_PIN, { action: "cap", workspace_id: 2, allowance: "ai", cap: 40 });
    expect((await post(TEST_PIN, { action: "copy", workspace_id: 3, from_id: 2 })).status).toBe(
      200,
    );
    expect(await settingsOf(3)).toEqual(await settingsOf(2));
    expect((await settingsOf(3))?.caps.ai).toBe(40);
    // From OGs, which never had a row: everything on, no cap.
    await post(TEST_PIN, { action: "copy", workspace_id: 3, from_id: 1 });
    expect(await settingsOf(3)).toEqual({ off: [], caps: { ai: null, translate: null } });
    expect((await post(TEST_PIN, { action: "copy", workspace_id: 3, from_id: 3 })).status).toBe(
      400,
    );
    expect((await post(TEST_PIN, { action: "copy", workspace_id: 3, from_id: 99 })).status).toBe(
      404,
    );
  });
});
