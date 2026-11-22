// POST /api/w/[slug]/raid-prep (D137, issue 474): Alliance settings → Raid Shield check. An officer's save
// is stored; a morning time outside 10:00–11:00 ST is refused; a member's session saves nothing (D105).
// Invented names only.
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppContext } from "@/lib/app-context";
import { testContext } from "@/lib/app-context.test-helpers";
import { T0 } from "@/lib/collector.test-helpers";
import type { Db } from "@/lib/db";
import { openTestDb, truncateAll } from "@/lib/db.test-helpers";
import { createSession, SESSION_COOKIE } from "@/lib/private/session";
import { workspaces, workspaceUsers } from "@/lib/schema";
import { workspaceFeatures } from "@/lib/schema-features";
import { shieldSettings } from "@/lib/schema-shield";

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
  // The owner allows the Raid Shield check and the officers turned it on: its settings save only then (D134).
  const on = { shield_check: true };
  await db.insert(workspaceFeatures).values({ workspaceId, switches: on, allianceSwitches: on });
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

const post = (body: unknown, token = officer) =>
  route.POST(
    new Request(`${ORIGIN}/api/w/nse/raid-prep`, {
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

const stored = async () => {
  const [row] = await db.select().from(shieldSettings);
  if (!row) return null;
  return { morningMinute: row.morningMinute, discord: row.discord, language: row.language };
};

describe("POST /api/w/[slug]/raid-prep (D137)", () => {
  it("stores the morning time an officer saves", async () => {
    const res = await post({ morningMinute: 660, discord: false, language: "fr" }); // 11:00 ST
    expect([res.status, await res.json()]).toEqual([200, { ok: true }]);
    expect(await stored()).toEqual({ morningMinute: 660, discord: false, language: "fr" });
  });

  it("refuses a morning time before 10:00 or after 11:00 ST and stores nothing", async () => {
    for (const morningMinute of [585, 675]) {
      // 09:45 and 11:15 ST
      const res = await post({ morningMinute, discord: false, language: "en" });
      expect([res.status, await res.json()]).toEqual([400, { code: "bad_request" }]);
    }
    expect(await stored()).toBeNull();
  });

  it("refuses a member's save and keeps the officers' morning time", async () => {
    await post({ morningMinute: 630, discord: false, language: "en" }); // 10:30 ST
    const res = await post({ morningMinute: 600, discord: false, language: "en" }, member);
    expect([res.status, await res.json()]).toEqual([401, { code: "signed_out" }]);
    expect((await stored())?.morningMinute).toBe(630);
  });
});
