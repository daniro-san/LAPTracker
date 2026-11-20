// POST /api/w/[slug]/features (D134, issue 476): the officers turn on what the site's owner allows; a feature
// the owner did not allow is not in their list and cannot be turned on; the switches are rate limited; each
// feature that spends tracker calls says about how many. Invented names only.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { requireWorkspace } from "@/lib/private/access";
import { allianceFeaturesView, SWITCHES } from "@/lib/private/alliance-features";
import { featuresBySlug } from "@/lib/private/features";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { dailyReads, dailyRosters, workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceFeatures } from "@/lib/schema-features";

const holder = vi.hoisted(() => ({ ctx: null as AppContext | null }));
vi.mock("@/lib/app-context", async (original) => ({
  ...(await original<typeof import("@/lib/app-context")>()),
  getAppContext: () => holder.ctx,
}));

const route = await import("./route");

const ORIGIN = "https://laptracker.test";
let db: Db;
let officer = "";
let workspaceId = 0;

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
  const [user] = await db
    .insert(workspaceUsers)
    .values({ workspaceId, discordUserId: "u-1", displayName: "Ana" })
    .returning({ id: workspaceUsers.id });
  officer = (await createSession(db, workspaceId, user?.id ?? 0, T0, null, "officer")).token;
});

/** The owner allows the squads read (D126's switch). */
const allowSquads = () =>
  db.insert(workspaceFeatures).values({ workspaceId, switches: { squads: true } });

const post = (body: unknown) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/nse/features`, {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
        cookie: `${SESSION_COOKIE}=${officer}`,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug: "nse" }) },
  );

const view = async () => {
  const access = await requireWorkspace(db, "nse", { get: () => ({ value: officer }) }, T0);
  if (!access.ok) throw new Error("no access");
  return allianceFeaturesView(db, access);
};
const listed = async () => (await view()).groups.flatMap((g) => g.features.map((f) => f.feature));

describe("POST /api/w/[slug]/features (D134)", () => {
  it("lists only what the owner allows, and refuses to turn on the rest", async () => {
    expect(await listed()).not.toContain("squads");
    const refused = await post({ feature: "squads", on: true });
    expect([refused.status, await refused.json()]).toEqual([403, { code: "not_allowed" }]);
    expect((await featuresBySlug(db, "nse"))?.on.has("squads")).toBe(false);

    await allowSquads();
    expect(await listed()).toContain("squads");
    // The answer carries the switch as stored, which the page shows after the save.
    const saved = await post({ feature: "squads", on: true });
    expect([saved.status, await saved.json()]).toEqual([200, { ok: true, on: true }]);
    expect((await featuresBySlug(db, "nse"))?.on.has("squads")).toBe(true);
    expect((await post({ feature: "thefts", on: false })).status).toBe(200);
    expect((await featuresBySlug(db, "nse"))?.on.has("thefts")).toBe(false);
  });

  it("estimates the tracker calls from the newest roster's members", async () => {
    await allowSquads();
    await post({ feature: "squads", on: true });
    await db.insert(dailyReads).values({ day: "2026-11-18", startedAt: T0, status: "complete" });
    await db.insert(dailyRosters).values({
      readDay: "2026-11-18",
      unionId: 67109944,
      memberCount: 101,
      isFresh: true,
      memberUids: [],
      memberNames: [],
      memberPower: [],
      memberKills: [],
    });
    const v = await view();
    expect(v.members).toBe(101);
    expect(v.estimate).toEqual({ daily: 108, peak: 108 });
    const squads = v.groups.flatMap((g) => g.features).find((f) => f.feature === "squads");
    expect(squads?.calls).toEqual({ n: 108, weekly: false });
  });

  it("refuses past the window's switches, and a request without a session", async () => {
    for (let i = 0; i < SWITCHES; i++) await post({ feature: "thefts", on: i % 2 === 0 });
    const limited = await post({ feature: "thefts", on: true });
    expect([limited.status, await limited.json()]).toEqual([429, { code: "rate_limited" }]);
    officer = "not-a-session";
    expect((await post({ feature: "thefts", on: true })).status).toBe(401);
  });
});
