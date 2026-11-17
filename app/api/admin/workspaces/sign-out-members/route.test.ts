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
    new Request("https://laptracker.test/api/admin/workspaces/sign-out-members", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", "x-edit-pin": pin },
      body: JSON.stringify(body),
    }),
  );

describe("POST /api/admin/workspaces/sign-out-members (D105)", () => {
  it("ends only that workspace's member sessions, behind the PIN", async () => {
    const ids: number[] = [];
    for (const slug of ["ogs", "nse"]) {
      const [ws] = await db
        .insert(workspaces)
        .values({
          unionId: slug === "ogs" ? 1 : 2,
          slug,
          discordGuildId: "1",
          leaderRoleIds: ["2"],
        })
        .returning({ id: workspaces.id });
      const id = ws?.id ?? 0;
      ids.push(id);
      for (const tier of ["officer", "member"] as const) {
        const [user] = await db
          .insert(workspaceUsers)
          .values({ workspaceId: id, discordUserId: `${slug}-${tier}`, displayName: tier })
          .returning({ id: workspaceUsers.id });
        await db.insert(workspaceSessions).values({
          tokenHash: `${slug}-${tier}-hash`,
          workspaceId: id,
          workspaceUserId: user?.id ?? 0,
          createdAt: T0,
          expiresAt: new Date(T0.getTime() + 86_400_000),
          tier,
        });
      }
    }
    expect((await post("wrong-pin", { workspace_id: ids[0] })).status).toBe(401);
    const res = await post(TEST_PIN, { workspace_id: ids[0] });
    expect([res.status, await res.json()]).toEqual([200, { ended: 1 }]);
    const left = await db.select().from(workspaceSessions);
    expect(left.map((s) => [s.workspaceId, s.tier]).sort()).toEqual(
      [
        [ids[0], "officer"],
        [ids[1], "member"],
        [ids[1], "officer"],
      ].sort(),
    );
  });
});
