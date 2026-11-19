// POST /api/admin/workspaces/deletion (D125): the owner asks to delete a workspace with the same 14 days, and
// cancels it. PIN only; a workspace that is gone answers 404.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_PIN, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { listWorkspaces } from "@/lib/queries/workspaces";
import { SEED_AT, seedWorkspace } from "@/lib/workspace-data.test-helpers";

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
  const test = testContext(db);
  test.clock.now = SEED_AT;
  holder.ctx = test.ctx;
});

const post = (pin: string, body: unknown) =>
  route.POST(
    new Request("https://laptracker.test/api/admin/workspaces/deletion", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", "x-edit-pin": pin },
      body: JSON.stringify(body),
    }),
  );

const PURGE_AT = new Date(SEED_AT.getTime() + 14 * 86_400_000);

describe("POST /api/admin/workspaces/deletion (D125)", () => {
  it("asks with the 14 days and cancels, PIN only", async () => {
    const { workspaceId } = await seedWorkspace(db, "nse", 67109944);
    expect((await post("wrong-pin", { workspace_id: workspaceId, action: "ask" })).status).toBe(
      401,
    );
    expect((await post(TEST_PIN, { workspace_id: 999, action: "ask" })).status).toBe(404);

    const asked = await post(TEST_PIN, { workspace_id: workspaceId, action: "ask" });
    expect(await asked.json()).toEqual({ purge_after: PURGE_AT.toISOString() });
    const [shown] = await listWorkspaces(db, SEED_AT);
    expect(shown?.deletion).toEqual({
      askedAt: SEED_AT,
      byOwner: true,
      by: null,
      purgeAfter: PURGE_AT,
    });

    const cancelled = await post(TEST_PIN, { workspace_id: workspaceId, action: "cancel" });
    expect(await cancelled.json()).toEqual({ cancelled: true, purge_after: null });
    expect((await listWorkspaces(db, SEED_AT))[0]?.deletion).toBeNull();
  });
});
