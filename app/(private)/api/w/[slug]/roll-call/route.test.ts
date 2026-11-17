import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { createEntry } from "@/lib/private/calendar";
import type { NewEntry } from "@/lib/private/calendar-model";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { dailyReads, dailyRosters, workspaces, workspaceUsers } from "@/lib/schema";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const OGS = 67111155;
const URL_ = "https://laptracker.test/api/w/ogs/roll-call";
const WEEK = "2026-11-02";

let db: Db;
const tokens: Record<string, string> = {};
let kvk = 0;

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
    memberCount: 2,
    isFresh: true,
    sourceUpdatedAt: T0,
    memberUids: [101, 102],
    memberNames: ["P101", "P102"],
    memberPower: [1000, 1000],
    memberKills: [0, 0],
  });
  for (const name of ["Ana", "Bo"]) {
    const [user] = await db
      .insert(workspaceUsers)
      .values({ workspaceId: ws?.id ?? 0, discordUserId: `ogs-${name}`, displayName: name })
      .returning({ id: workspaceUsers.id });
    tokens[name] = (await createSession(db, ws?.id ?? 0, user?.id ?? 0, T0, null, "officer")).token;
  }
  const access = await requireWorkspace(
    db,
    "ogs",
    { get: () => ({ value: tokens.Ana ?? "" }) },
    T0,
  );
  if (!access.ok) throw new Error("no access");
  const entry = { kind: "kvk", day: "2026-11-07", minute: 720, notes: null, link: null };
  const made = await createEntry(
    db,
    access,
    { ...entry, forMembers: false, notice: null, weekly: false } as NewEntry,
    randomUUID(),
  );
  if (!made.ok) throw new Error(made.code);
  kvk = made.id;
});

const post = (body: unknown, opts: { who?: string; origin?: string; type?: string } = {}) =>
  route.POST(
    new Request(URL_, {
      method: "POST",
      headers: {
        origin: opts.origin ?? "https://laptracker.test",
        "content-type": opts.type ?? "application/json",
        ...(opts.who && { cookie: `${SESSION_COOKIE}=${tokens[opts.who]}` }),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );

const mark = (uid: number, m: "yes" | "no", version: number) => ({
  action: "mark",
  occasion: { entry: kvk, week: WEEK },
  uid,
  mark: m,
  version,
});

describe("POST /api/w/[slug]/roll-call (issue 298)", () => {
  it("refuses a form from elsewhere (403) and a request without a session (401)", async () => {
    expect((await post(mark(101, "yes", 0), { who: "Ana", type: "text/plain" })).status).toBe(403);
    const cross = await post(mark(101, "yes", 0), { who: "Ana", origin: "https://evil.test" });
    expect([cross.status, await cross.json()]).toEqual([403, { code: "forbidden" }]);
    const out = await post(mark(101, "yes", 0));
    expect([out.status, await out.json()]).toEqual([401, { code: "signed_out" }]);
  });

  it("answers 400 for a bad body or a non-member, 404 for an occasion of no workspace", async () => {
    const badDay = await post(
      { ...mark(101, "yes", 0), occasion: { entry: kvk, week: "2026-02-31" } },
      { who: "Ana" },
    );
    expect([badDay.status, await badDay.json()]).toEqual([400, { code: "bad_request" }]);
    const nobody = await post(mark(999, "yes", 0), { who: "Ana" });
    expect([nobody.status, await nobody.json()]).toEqual([400, { code: "not_member" }]);
    const gone = await post({ ...mark(101, "yes", 0), occasion: { id: 4242 } }, { who: "Ana" });
    expect([gone.status, await gone.json()]).toEqual([404, { code: "not_found" }]);
  });

  it("answers a stale mark with 409, the newer mark, its version and who set it", async () => {
    const first = await post(mark(101, "no", 0), { who: "Ana" });
    expect(await first.json()).toEqual({ ok: true, version: 1 });
    const stale = await post(mark(101, "yes", 0), { who: "Bo" });
    expect(stale.status).toBe(409);
    expect(stale.headers.get("cache-control")).toBe("private, no-store");
    const body = (await stale.json()) as {
      code: string;
      mark: string;
      version: number;
      said: string;
    };
    expect([body.code, body.mark, body.version]).toEqual(["stale", "no", 1]);
    expect(body.said).toMatch(/Ana.* marked “No shield” just now/);
  });
});
