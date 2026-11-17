import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { saveFacts } from "@/lib/private/member-facts";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { dailyReads, dailyRosters, workspaces, workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const OGS = 67111155;
const URL_ = "https://laptracker.test/api/w/ogs/follow-up";

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
    .values({ unionId: OGS, slug: "ogs", discordGuildId: "1", leaderRoleIds: ["2"] })
    .returning({ id: workspaces.id });
  await db.insert(dailyReads).values({ day: "2026-11-06", startedAt: T0, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-06",
    unionId: OGS,
    memberCount: 1,
    isFresh: true,
    sourceUpdatedAt: T0,
    memberUids: [101],
    memberNames: ["P101"],
    memberPower: [1000],
    memberKills: [0],
  });
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: ws?.id ?? 0, discordUserId: "ogs-ana", displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  token = (await createSession(db, ws?.id ?? 0, user?.id ?? 0, T0, null)).token;
});

const post = (body: unknown, signedIn = true) =>
  route.POST(
    new Request(URL_, {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": "application/json",
        ...(signedIn && { cookie: `${SESSION_COOKIE}=${token}` }),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );

const record = (extra: object = {}) => ({
  uid: 101,
  action: "talked",
  note: "",
  until: null,
  version: 0,
  requestId: randomUUID(),
  ...extra,
});

describe("POST /api/w/[slug]/follow-up (issue 340)", () => {
  it("answers 401 without a session, 400 for a bad action, a note over 500 characters or an extra key", async () => {
    const out = await post(record(), false);
    expect([out.status, await out.json()]).toEqual([401, { code: "signed_out" }]);
    for (const body of [
      record({ action: "remove" }),
      record({ note: "x".repeat(501) }),
      record({ officer: "Ana" }),
    ]) {
      const bad = await post(body);
      expect([bad.status, await bad.json()]).toEqual([400, { code: "bad_request" }]);
    }
    expect((await post(record({ note: "x".repeat(500) }))).status).toBe(200);
  });

  it("answers Needs help over a newer status with 409, its version and its words", async () => {
    const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, T0);
    if (!access.ok) throw new Error("no access");
    const onBreak = { field: "status", version: 0, value: "break", source: "officer" } as const;
    await saveFacts(db, access, 101, [onBreak], T0);
    const stale = await post(record({ action: "help" }));
    expect(stale.status).toBe(409);
    expect(stale.headers.get("cache-control")).toBe("private, no-store");
    expect(await stale.json()).toEqual({
      code: "stale",
      version: 1,
      said: "Another officer changed this just now: On a break. Save again to replace it.",
    });
    expect((await post(record({ action: "help", version: 1 }))).status).toBe(200);
  });
});
