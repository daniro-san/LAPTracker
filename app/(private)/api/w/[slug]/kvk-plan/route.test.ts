// POST /api/w/[slug]/kvk-plan (issue 790, D161): a save over an old version is 409 stale, a role naming
// someone not on the roster is 400 invalid, a body the schema refuses is 400 bad_request, the route is
// 403 turned_off with Notices off, and a request from another site is 403 forbidden. Invented names only.
import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { createEntry } from "@/lib/private/calendar";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { dailyReads, dailyRosters, kvkPlans, workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceFeatures } from "@/lib/schema-features";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const OGS = 67111155;
const ORIGIN = "https://laptracker.test";

let db: Db;
let token = "";
let workspaceId = 0;
let entry = 0;

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
  workspaceId = ws?.id ?? 0;
  await db.insert(dailyReads).values({ day: "2026-11-06", startedAt: T0, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-06",
    unionId: OGS,
    memberCount: 2,
    isFresh: true,
    sourceUpdatedAt: T0,
    memberUids: [101, 102],
    memberNames: ["Bramble Fox", "Quillon Ash"],
    memberPower: [1000, 1000],
    memberKills: [0, 0],
  });
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: "ws-Ana", displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  token = (await createSession(db, workspaceId, user?.id ?? 0, T0, null, "officer")).token;
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, T0);
  if (!access.ok) throw new Error("no access");
  const kvk = { kind: "kvk", day: "2026-11-07", minute: 720 } as const;
  const base = { notes: null, link: null, forMembers: false, notice: null, weekly: false };
  const made = await createEntry(db, access, { ...kvk, ...base }, randomUUID());
  if (!made.ok) throw new Error(made.code);
  entry = made.id;
});

const post = (body: unknown, origin = ORIGIN) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/ogs/kvk-plan`, {
      method: "POST",
      headers: {
        origin,
        "sec-fetch-site": origin === ORIGIN ? "same-origin" : "cross-site",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );

const save = (rev: number, uids: number[]) =>
  post({ action: "save", entry, rev, roles: [{ name: "Rally lead", uids }], note: "" });

const answer = async (res: Response) => [res.status, await res.json()];

describe("POST /api/w/[slug]/kvk-plan (issue 790)", () => {
  it("refuses a save over a version another officer already replaced (409 stale)", async () => {
    expect(await answer(await save(0, [101]))).toEqual([200, { ok: true, rev: 1 }]);
    expect(await answer(await save(0, [102]))).toEqual([409, { code: "stale" }]);
    const [row] = await db.select().from(kvkPlans);
    expect(row?.roles).toEqual([{ name: "Rally lead", uids: [101] }]);
  });

  it("refuses someone not on the roster (400 invalid) and a body it cannot read (400 bad_request)", async () => {
    expect(await answer(await save(0, [999]))).toEqual([400, { code: "invalid" }]);
    expect(await answer(await save(0, [101, 101]))).toEqual([400, { code: "bad_request" }]);
    const empty = { action: "save", entry, rev: 0, roles: [{ name: " ", uids: [] }], note: "" };
    expect(await answer(await post(empty))).toEqual([400, { code: "bad_request" }]);
    expect(await db.select().from(kvkPlans)).toEqual([]);
  });

  it("is turned off with the alliance's Notices (403 turned_off)", async () => {
    await db.insert(workspaceFeatures).values({ workspaceId, switches: { notices: false } });
    expect(await answer(await save(0, [101]))).toEqual([403, { code: "turned_off" }]);
    const make = { action: "message", entry, week: "2026-11-02", requestId: randomUUID() };
    expect(await answer(await post(make))).toEqual([403, { code: "turned_off" }]);
    expect(await db.select().from(kvkPlans)).toEqual([]);
  });

  it("refuses a request from another site (403 forbidden)", async () => {
    const body = { action: "save", entry, rev: 0, roles: [], note: "" };
    expect(await answer(await post(body, "https://evil.test"))).toEqual([
      403,
      { code: "forbidden" },
    ]);
    expect(await db.select().from(kvkPlans)).toEqual([]);
  });
});
