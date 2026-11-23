// A feedback send's picture (D157 amended 2026-11-22) is served on /admin only: the owner's PIN session gets
// its bytes; no session, and an officer's workspace session of the sender's own workspace, get the same 404
// as a missing picture. Invented workspace, person and bytes only.
import { createHash } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { adminToken } from "@/lib/admin-session";
import type { AppContext } from "@/lib/app-context";
import { TEST_ENV, testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { workspaceSessions, workspaces, workspaceUsers } from "@/lib/schema";
import { feedback, feedbackPictures } from "@/lib/schema-feedback";

import { GET } from "./route";

const holder = vi.hoisted(() => ({
  ctx: null as AppContext | null,
  jar: {} as Record<string, string>,
}));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));
vi.mock("@/lib/env", async (original) => ({
  ...(await original<typeof import("@/lib/env")>()),
  getEnv: () => TEST_ENV,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name in holder.jar ? { value: holder.jar[name] } : undefined),
  }),
}));

const BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 9, 8, 7]);
/** An officer's live workspace session, as the browser holds it (lib/private/session.ts's cookie and hash). */
const OFFICER = { cookie: "__Host-lap_ws.alpha", token: "invented-officer-token" };
let db: Db;

beforeAll(async () => {
  db = await openTestDb();
});
beforeEach(async () => {
  await truncateAll(db);
  holder.ctx = testContext(db).ctx;
  holder.jar = {};
  const [ws] = await db
    .insert(workspaces)
    .values({
      unionId: 900_001,
      slug: "alpha",
      discordGuildId: "1",
      leaderRoleIds: ["2"],
      memberRoleIds: ["3"],
    })
    .returning({ id: workspaces.id });
  const workspaceId = ws?.id ?? 0;
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: "d-1", displayName: "Invented Officer" })
    .returning({ id: workspaceUsers.id });
  await db.insert(workspaceSessions).values({
    tokenHash: createHash("sha256").update(OFFICER.token).digest("hex"),
    workspaceId,
    workspaceUserId: user?.id ?? 0,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
  });
  const [sent] = await db
    .insert(feedback)
    .values({
      area: "desk",
      kind: "problem",
      text: "The chart is cut off",
      path: "/w/alpha",
      language: "en",
      workspaceId,
      tier: "officer",
      createdAt: T0,
    })
    .returning({ id: feedback.id });
  await db.insert(feedbackPictures).values({
    feedbackId: sent?.id ?? 0,
    workspaceId,
    data: BYTES,
    type: "image/png",
    width: 1,
    height: 1,
    bytes: BYTES.length,
    hash: "abc123",
  });
});

const get = async (id = "1", headers: Record<string, string> = {}) => {
  const url = `https://laptracker.test/admin/feedback/picture/${id}`;
  const res = await GET(new Request(url, { headers }), { params: Promise.resolve({ id }) });
  return {
    status: res.status,
    type: res.headers.get("content-type"),
    cache: res.headers.get("cache-control"),
    etag: res.headers.get("etag"),
    body: await res.bytes(),
  };
};

describe("/admin/feedback/picture/[id] (D157)", () => {
  it("refuses a request without the PIN session, and an officer's workspace session, with a bare 404", async () => {
    expect((await get()).status).toBe(404);
    holder.jar = { [OFFICER.cookie]: OFFICER.token };
    const officer = await get();
    expect(officer.status).toBe(404);
    expect(officer.body.length).toBe(0);
  });

  it("serves the bytes to the owner's PIN session, and a 404 for a send without a picture", async () => {
    holder.jar = { lap_admin: adminToken(TEST_ENV, new Date()) };
    const owner = await get();
    expect(owner.status).toBe(200);
    expect(owner.type).toBe("image/png");
    expect(owner.body).toEqual(BYTES);
    expect((await get("2")).status).toBe(404);
  });

  it("never lets a shared cache keep it, and answers an unchanged picture with 304 and no bytes", async () => {
    holder.jar = { lap_admin: adminToken(TEST_ENV, new Date()) };
    const owner = await get();
    expect([owner.cache, owner.etag]).toEqual(["private, no-cache", '"abc123"']);
    const again = await get("1", { "if-none-match": '"abc123"' });
    expect([again.status, again.cache, again.body.length]).toEqual([304, "private, no-cache", 0]);
    expect((await get("1", { "if-none-match": '"stale"' })).status).toBe(200);
    // A refusal is never kept either.
    holder.jar = {};
    expect((await get()).cache).toBe("private, no-store");
  });
});
