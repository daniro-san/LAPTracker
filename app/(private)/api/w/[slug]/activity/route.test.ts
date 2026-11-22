// The next page of Home's recent activity (D108, 2026-11-18): an officer's session only, and a cursor that
// is a time a page can start before.
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

const { GET } = await import("./route");

let db: Db;
let token: string;
beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  await db
    .insert(workspaces)
    .values({ unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] });
  holder.ctx = testContext(db).ctx;
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: 1, discordUserId: "id-ana", displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  token = (await createSession(db, 1, user?.id ?? 0, T0, null, "officer")).token;
});

async function page(before: string) {
  const response = await GET(
    new Request(`https://laptracker.test/api/w/ogs/activity?before=${before}`, {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

describe("GET /api/w/[slug]/activity", () => {
  it("answers a page to an officer, 400 for a bad or out-of-range cursor", async () => {
    expect(await page(String(T0.getTime()))).toEqual({
      status: 200,
      body: { lines: [], next: null },
    });
    expect((await page("abc")).status).toBe(400);
    expect((await page("8640000000000000")).status).toBe(400);
  });
});
