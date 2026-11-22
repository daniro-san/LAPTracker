// POST /api/admin/feedback (D157): the owner's status on a feedback item, PIN only. An officer's or a member's
// workspace session opens nothing here; the status changes only with the PIN. Invented text only.
import { createHash } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_PIN, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { workspaces, workspaceSessions, workspaceUsers } from "@/lib/schema";
import { feedback } from "@/lib/schema-feedback";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

let db: Db;
let officerCookie = "";
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db).ctx;
  const [w] = await db
    .insert(workspaces)
    .values({ unionId: 900_001, slug: "alpha", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  const [u] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: w?.id ?? 0, discordUserId: "d-rook", displayName: "Rook Invented" })
    .returning({ id: workspaceUsers.id });
  // A live officer session of Alpha (the desk's cookie holds the token; the row its SHA-256).
  await db.insert(workspaceSessions).values({
    tokenHash: createHash("sha256").update("officer-token").digest("hex"),
    workspaceId: w?.id ?? 0,
    workspaceUserId: u?.id ?? 0,
    tier: "officer",
    createdAt: T0,
    expiresAt: new Date(T0.getTime() + 86_400_000),
  });
  officerCookie = "__Host-lap_ws.alpha=officer-token";
  await db.insert(feedback).values({
    area: "desk",
    kind: "idea",
    text: "A month view in the calendar",
    path: "/w/alpha/calendar",
    language: "en",
    workspaceId: w?.id ?? null,
    tier: "officer",
    createdAt: T0,
  });
});

const post = async (headers: Record<string, string>, body: unknown) => {
  const res = await route.POST(
    new Request("https://laptracker.test/api/admin/feedback", {
      method: "POST",
      headers: { "x-real-ip": "198.51.100.1", ...headers },
      body: JSON.stringify(body),
    }),
  );
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
};
const statuses = async () => (await db.select().from(feedback)).map((r) => r.status);

describe("POST /api/admin/feedback (D157)", () => {
  it("refuses an officer's workspace session without the PIN, and a wrong PIN, and changes nothing", async () => {
    expect((await post({ cookie: officerCookie }, { id: 1, status: "dropped" })).status).toBe(401);
    expect((await post({ "x-edit-pin": "wrong-pin" }, { id: 1, status: "dropped" })).status).toBe(
      401,
    );
    expect(await statuses()).toEqual(["new"]);
  });

  it("sets the status with the PIN, and answers 404 for an item that is gone", async () => {
    expect(await post({ "x-edit-pin": TEST_PIN }, { id: 1, status: "issue" })).toEqual({
      status: 200,
      body: { ok: true },
    });
    expect(await statuses()).toEqual(["issue"]);
    expect((await post({ "x-edit-pin": TEST_PIN }, { id: 2, status: "read" })).status).toBe(404);
    expect((await post({ "x-edit-pin": TEST_PIN }, { id: 1, status: "planned" })).status).toBe(400);
  });
});
