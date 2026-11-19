// POST /api/w/[slug]/garrison (issue 423, D121): a save that breaks a pair rule is refused with 400 and
// stores nothing: the helper's kept (strongest) squad, a member not on the roster, a squad lent twice.
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
import { dailyReads, dailyRosters, garrisonPlans, workspaces, workspaceUsers } from "@/lib/schema";
import { memberSquads } from "@/lib/schema-squads";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const OGS = 67111155;
const WEEK = "2026-11-02";

let db: Db;
let token = "";
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
  await db.insert(dailyReads).values({ day: "2026-11-06", startedAt: T0, status: "complete" });
  await db.insert(dailyRosters).values({
    readDay: "2026-11-06",
    unionId: OGS,
    memberCount: 3,
    isFresh: true,
    sourceUpdatedAt: T0,
    memberUids: [101, 102, 103],
    memberNames: ["P101", "P102", "P103"],
    memberPower: [1000, 1000, 1000],
    memberKills: [0, 0, 0],
  });
  // 101 keeps squad 1 (15M) and lends squads 2 and 3; 102 and 103 need help.
  await db.insert(memberSquads).values(
    [
      [101, 1, 15e6],
      [101, 2, 12e6],
      [101, 3, 11e6],
      [102, 1, 5e6],
      [103, 1, 4e6],
    ].map(([uid, squad, power]) => ({
      unionId: OGS,
      uid: uid ?? 0,
      squad: squad ?? 0,
      power: power ?? 0,
      heroes: [],
      readAt: T0,
    })),
  );
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId: ws?.id ?? 0, discordUserId: "ws-Ana", displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  token = (await createSession(db, ws?.id ?? 0, user?.id ?? 0, T0, null, "officer")).token;
  const access = await requireWorkspace(db, "ogs", { get: () => ({ value: token }) }, T0);
  if (!access.ok) throw new Error("no access");
  const siege = { kind: "undead", level: 6, day: "2026-11-07", minute: 720 } as const;
  const base = { notes: null, link: null, forMembers: false, notice: null, weekly: false };
  const made = await createEntry(db, access, { ...siege, ...base }, randomUUID());
  if (!made.ok) throw new Error(made.code);
  entry = made.id;
});

const post = (body: unknown) =>
  route.POST(
    new Request("https://laptracker.test/api/w/ogs/garrison", {
      method: "POST",
      headers: {
        origin: "https://laptracker.test",
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${token}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "ogs" }) },
  );

const save = (pairs: { helper: number; squad: number; member: number }[]) =>
  post({ action: "save", entry, week: WEEK, rev: 0, pairs });

describe("POST /api/w/[slug]/garrison (issue 423)", () => {
  it("refuses the helper's kept squad, a member not on the roster and a squad lent twice", async () => {
    for (const pairs of [
      [{ helper: 101, squad: 1, member: 102 }],
      [{ helper: 101, squad: 2, member: 999 }],
      [
        { helper: 101, squad: 2, member: 102 },
        { helper: 101, squad: 2, member: 103 },
      ],
    ]) {
      const res = await save(pairs);
      expect([res.status, await res.json()]).toEqual([400, { code: "invalid" }]);
    }
    expect(await db.select().from(garrisonPlans)).toEqual([]);
    expect((await save([{ helper: 101, squad: 2, member: 102 }])).status).toBe(200);
  });
});
