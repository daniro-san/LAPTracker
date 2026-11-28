// POST /api/w/[slug]/kvk-castle (issue 791): Insights → KvK's castle point. An officer's point is stored and
// can be cleared; a square outside 0–999 is refused; a member's session saves nothing (D105). Another
// workspace's officer is refused in member-session.test.ts. Invented names only.
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const ORIGIN = "https://laptracker.test";
let db: Db;
let workspaceId = 0;
let officer = "";
let member = "";

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db).ctx;
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: 67109944, slug: "nse", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  workspaceId = ws?.id ?? 0;
  const users = await db
    .insert(workspaceUsers)
    .values([
      { workspaceId, discordUserId: "u-1", displayName: "Ana" },
      { workspaceId, discordUserId: "u-2", displayName: "Bram" },
    ])
    .returning({ id: workspaceUsers.id });
  officer = (await createSession(db, workspaceId, users[0]?.id ?? 0, T0, null, "officer")).token;
  member = (await createSession(db, workspaceId, users[1]?.id ?? 0, T0, null, "member")).token;
});

/** The stored point, as the two columns. */
const stored = async () => {
  const [row] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  return [row?.castleX, row?.castleY];
};

const post = (body: unknown, token = officer) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/nse/kvk-castle`, {
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

describe("POST /api/w/[slug]/kvk-castle (issue 791)", () => {
  it("stores the castle point an officer saves, and clears it", async () => {
    const res = await post({ castleX: 412, castleY: 87 });
    expect([res.status, await res.json()]).toEqual([200, { ok: true }]);
    expect(await stored()).toEqual([412, 87]);
    expect((await post({ castleX: null, castleY: null })).status).toBe(200);
    expect(await stored()).toEqual([null, null]);
  });

  it("refuses a square outside 0 to 999, or only one of the two, and stores nothing", async () => {
    for (const body of [
      { castleX: 1000, castleY: 5 },
      { castleX: -1, castleY: 5 },
      { castleX: 2.5, castleY: 5 },
      { castleX: 5, castleY: null },
    ]) {
      const res = await post(body);
      expect([res.status, await res.json()]).toEqual([400, { code: "bad_request" }]);
    }
    expect(await stored()).toEqual([null, null]);
  });

  it("refuses a member's save and keeps the officers' point", async () => {
    await post({ castleX: 300, castleY: 300 });
    const res = await post({ castleX: null, castleY: null }, member);
    expect([res.status, await res.json()]).toEqual([401, { code: "signed_out" }]);
    expect(await stored()).toEqual([300, 300]);
  });
});
