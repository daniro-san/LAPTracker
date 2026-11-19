// POST /api/w/[slug]/workspace-deletion (D125): an officer asks to delete the workspace by typing its
// address; everyone keeps access for 14 days with the date on every page; any officer can cancel. The daily
// job that deletes it after the 14 days is tested in lib/repo/workspace-purge.test.ts.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireBoard, requireWorkspace } from "@/lib/private/access";
import { activityPage } from "@/lib/private/desk-activity";
import { activityLine } from "@/lib/private/desk-activity-words";
import { WORKSPACE_DICTIONARIES } from "@/lib/private/dictionary";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { SEED_AT, seedWorkspace } from "@/lib/workspace-data.test-helpers";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const ORIGIN = "https://laptracker.test";
const DAY_MS = 86_400_000;
const ID = () => crypto.randomUUID();

let db: Db;
const tokens = { ana: "", wren: "", member: "" };

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  const test = testContext(db, TEST_ENV);
  test.clock.now = SEED_AT;
  holder.ctx = test.ctx;
  const nse = await seedWorkspace(db, "nse", 67109944);
  const people = await db
    .insert(workspaceUsers)
    .values([
      { workspaceId: nse.workspaceId, discordUserId: "u-wren", displayName: "Wren" },
      { workspaceId: nse.workspaceId, discordUserId: "u-mia", displayName: "Mia" },
    ])
    .returning({ id: workspaceUsers.id });
  await db
    .update(workspaceUsers)
    .set({ displayName: "Ana" })
    .where(eq(workspaceUsers.id, nse.officer));
  // The members' board is open (a member role is set).
  await db.update(workspaces).set({ memberRoleIds: ["3"] });
  const session = (user: number, tier: "officer" | "member") =>
    createSession(db, nse.workspaceId, user, SEED_AT, null, tier).then((s) => s.token);
  tokens.ana = await session(nse.officer, "officer");
  tokens.wren = await session(people[0]?.id ?? 0, "officer");
  tokens.member = await session(people[1]?.id ?? 0, "member");
});

const post = (token: string, body: unknown) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/nse/workspace-deletion`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "nse" }) },
  );

const cookie = (token: string) => ({ get: () => ({ value: token }) });
const PURGE_AT = new Date(SEED_AT.getTime() + 14 * DAY_MS);

describe("POST /api/w/[slug]/workspace-deletion (D125)", () => {
  it("asks with the typed address, shows the date to everyone, and any officer cancels", async () => {
    const wrong = await post(tokens.ana, { action: "ask", address: "ogs", requestId: ID() });
    expect([wrong.status, await wrong.json()]).toEqual([400, { code: "address_mismatch" }]);
    const member = await post(tokens.member, { action: "ask", address: "nse", requestId: ID() });
    expect(member.status).toBe(401);

    const asked = await post(tokens.ana, { action: "ask", address: " NSE ", requestId: ID() });
    expect(await asked.json()).toEqual({ purgeAfter: PURGE_AT.toISOString() });
    // Everyone keeps access, and both the desk and the board carry the date.
    const desk = await requireWorkspace(db, "nse", cookie(tokens.wren), SEED_AT);
    const board = await requireBoard(db, "nse", cookie(tokens.member), SEED_AT);
    expect([desk.ok && desk.purgeAfter, board.ok && board.purgeAfter]).toEqual([
      PURGE_AT,
      PURGE_AT,
    ]);

    // Another officer cancels.
    const cancelled = await post(tokens.wren, { action: "cancel", requestId: ID() });
    expect(await cancelled.json()).toEqual({ purgeAfter: null });
    const [row] = await db.select().from(workspaces);
    expect([row?.deletionRequestedAt, row?.deletionRequestedBy, row?.purgeAfter]).toEqual([
      null,
      null,
      null,
    ]);
    if (!desk.ok) throw new Error("no access");
    const page = await activityPage(db, desk, { now: SEED_AT, zone: TEST_ENV.SERVER_TZ }, null, 10);
    const t = WORKSPACE_DICTIONARIES.en;
    expect(
      page.lines.map((l) => activityLine(l.item, t, "en").replace(/[\u2066-\u2069]/g, "")),
    ).toEqual([
      "Wren cancelled the deletion of this workspace",
      "Ana asked to delete this workspace",
    ]);
  });
});
