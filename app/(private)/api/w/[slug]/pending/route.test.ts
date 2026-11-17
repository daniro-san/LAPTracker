import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { memberFacts, pendingMembers, workspaces, workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const URL_ = "https://laptracker.test/api/w/ogs/pending";
let db: Db;
let token = "";

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db).ctx;
  const [ws] = await db
    .insert(workspaces)
    .values({ unionId: 67111155, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: ws?.id ?? 0, discordUserId: "ogs-ana", displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  token = (await createSession(db, ws?.id ?? 0, user?.id ?? 0, T0, null)).token;
});

const post = (body: unknown, opts: { signedIn?: boolean; type?: string } = {}) =>
  route.POST(
    new Request(URL_, {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": opts.type ?? "application/json",
        ...(opts.signedIn !== false && { cookie: `${SESSION_COOKIE}=${token}` }),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );

const add = (requestId: string, name = "Zephyrine") => ({
  action: "add",
  requestId,
  name,
  changes: [{ field: "troopTier", version: 0, value: 10, source: "officer" }],
});

describe("POST /api/w/[slug]/pending (D106)", () => {
  it("adds a new member with first facts; a repeat of the same request stores nothing new", async () => {
    const requestId = randomUUID();
    const first = await post(add(requestId));
    expect(first.status).toBe(200);
    expect(first.headers.get("cache-control")).toBe("private, no-store");
    const body = (await first.json()) as { uid: number; results: { status: string }[] };
    expect(body.uid).toBeLessThan(0);
    expect(body.results).toMatchObject([{ status: "saved", version: 1, value: 10 }]);

    const again = await post(add(requestId));
    expect(await again.json()).toEqual({ ok: true, uid: body.uid, results: [] });
    expect(await db.select().from(pendingMembers)).toHaveLength(1);
    expect(await db.select().from(memberFacts)).toHaveLength(1);
  });

  it("answers 401 signed_out without a session, 403 for a form, 400 for no name or request id", async () => {
    const out = await post(add(randomUUID()), { signedIn: false });
    expect([out.status, await out.json()]).toEqual([401, { code: "signed_out" }]);
    expect((await post(add(randomUUID()), { type: "text/plain" })).status).toBe(403);
    expect((await post(add(randomUUID(), "  "))).status).toBe(400);
    expect((await post({ ...add(randomUUID()), requestId: "again" })).status).toBe(400);
    const decoration = await post(add(randomUUID(), "★★"));
    expect([decoration.status, await decoration.json()]).toEqual([400, { code: "bad_name" }]);
    expect(await db.select().from(pendingMembers)).toEqual([]);
  });
});
